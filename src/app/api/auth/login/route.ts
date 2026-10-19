import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const organizationSlug = String(body.organizationSlug || process.env.DEFAULT_ORGANIZATION_SLUG || "empresa-principal").trim().toLowerCase();
    if (!email || !password || email.length > 200 || password.length > 200) return NextResponse.json({ error: "Introduza email e palavra-passe." }, { status: 400 });
    const user = await prisma.user.findFirst({ where: { email, active: true, organization: { slug: organizationSlug } }, include: { organization: true } });
    if (!user || user.organization.status !== "active" || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }
    const token = await createSession({ userId: user.id, organizationId: user.organizationId, role: user.role, name: user.name, email: user.email });
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, organization: { name: user.organization.name } });
    response.cookies.set(sessionCookieName, token, sessionCookieOptions);
    await prisma.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, action: "LOGIN", entityType: "User", entityId: user.id } });
    return response;
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Não foi possível iniciar sessão. Confirme a configuração do servidor." }, { status: 500 });
  }
}
