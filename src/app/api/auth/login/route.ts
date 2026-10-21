import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const audience = String(body.audience || "main");
    if (audience !== "main" && audience !== "technician") return NextResponse.json({ error: "Tipo de acesso inválido." }, { status: 400 });
    const organizationSlug = String(body.organizationSlug || process.env.DEFAULT_ORGANIZATION_SLUG || "empresa-principal").trim().toLowerCase();
    if (!email || !password || email.length > 200 || password.length > 200) return NextResponse.json({ error: "Digite seu e-mail e sua senha." }, { status: 400 });
    let user = await prisma.user.findFirst({ where: { email, active: true, organization: { slug: organizationSlug } }, include: { organization: true } });
    // First-run bootstrap: only the configured admin email + exact server-side initial password may create the first account.
    if (!user && email === (process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase() && password === process.env.INITIAL_ADMIN_PASSWORD) {
      const existingCount = await prisma.user.count({ where: { organization: { slug: organizationSlug } } });
      if (existingCount === 0) {
        const organization = await prisma.organization.upsert({
          where: { slug: organizationSlug },
          update: {},
          create: { name: process.env.COMPANY_NAME || "ISP Manager", slug: organizationSlug }
        });
        const passwordHash = await bcrypt.hash(password, 12);
        user = await prisma.user.create({
          data: { organizationId: organization.id, name: process.env.INITIAL_ADMIN_NAME || "Administrador", email, passwordHash, role: "MANAGER", active: true, mustChangePassword: true },
          include: { organization: true }
        });
        await prisma.brandingSettings.upsert({
          where: { organizationId: organization.id },
          update: {},
          create: { organizationId: organization.id, systemName: "ISP Manager", welcomeTitle: "Gestão operacional", welcomeMessage: "Acompanhe a operação da sua equipe." }
        });
      }
    }
    if (audience === "technician" && user && user.role !== "TECHNICIAN") return NextResponse.json({ error: "Esta página é exclusiva para contas de técnico." }, { status: 403 });
    if (audience === "main" && user && user.role === "TECHNICIAN") return NextResponse.json({ error: "Utiliza o acesso exclusivo dos técnicos." }, { status: 403 });
    if (!user || user.organization.status !== "active" || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }
    const token = await createSession({ userId: user.id, organizationId: user.organizationId, role: user.role, name: user.name, email: user.email, mustChangePassword: user.mustChangePassword });
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword }, organization: { name: user.organization.name }, mustChangePassword: user.mustChangePassword });
    response.cookies.set(sessionCookieName, token, sessionCookieOptions);
    await prisma.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, action: "LOGIN", entityType: "User", entityId: user.id } });
    return response;
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Não foi possível iniciar sessão. Confirme a configuração do servidor." }, { status: 500 });
  }
}
