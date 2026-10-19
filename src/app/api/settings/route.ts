import { NextRequest, NextResponse } from "next/server";
import { getSession, canManageBranding } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  const [organization, branding] = await Promise.all([
    prisma.organization.findUnique({ where: { id: session.organizationId }, select: { name: true } }),
    prisma.brandingSettings.findUnique({ where: { organizationId: session.organizationId } })
  ]);
  return NextResponse.json({ organization, branding });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (!canManageBranding(session.role)) return NextResponse.json({ error: "Só o gestor pode alterar a identidade visual." }, { status: 403 });
  try {
    const body = await request.json();
    const textFields = ["companyName", "productName", "logo", "primaryColor", "accentColor", "loginTitle", "loginMessage", "supportEmail", "supportPhone"];
    for (const key of textFields) if (body[key] !== undefined && typeof body[key] !== "string") return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
    if (String(body.productName || "").length > 50 || String(body.companyName || "").length > 70 || String(body.loginTitle || "").length > 90 || String(body.loginMessage || "").length > 220) return NextResponse.json({ error: "Um dos campos excede o limite permitido." }, { status: 400 });
    const logo = String(body.logo || "");
    if (logo.length > 1_600_000) return NextResponse.json({ error: "O logótipo é demasiado grande." }, { status: 413 });
    const primaryColor = String(body.primaryColor || "#4863ed");
    const accentColor = String(body.accentColor || "#22a77d");
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor) || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) return NextResponse.json({ error: "Formato de cor inválido." }, { status: 400 });
    const organizationName = String(body.companyName || "").trim();
    if (organizationName) await prisma.organization.update({ where: { id: session.organizationId }, data: { name: organizationName } });
    const branding = await prisma.brandingSettings.upsert({
      where: { organizationId: session.organizationId },
      update: { systemName: String(body.productName || "ISP Manager"), logoUrl: logo || null, primaryColor, accentColor, welcomeTitle: String(body.loginTitle || ""), welcomeMessage: String(body.loginMessage || ""), supportEmail: String(body.supportEmail || "") || null, supportPhone: String(body.supportPhone || "") || null },
      create: { organizationId: session.organizationId, systemName: String(body.productName || "ISP Manager"), logoUrl: logo || null, primaryColor, accentColor, welcomeTitle: String(body.loginTitle || ""), welcomeMessage: String(body.loginMessage || ""), supportEmail: String(body.supportEmail || "") || null, supportPhone: String(body.supportPhone || "") || null }
    });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "UPDATE_BRANDING", entityType: "BrandingSettings", entityId: branding.id, details: { systemName: branding.systemName, primaryColor, accentColor } } });
    return NextResponse.json({ ok: true, branding, organizationName });
  } catch (error) {
    console.error("Branding update failed", error);
    return NextResponse.json({ error: "Não foi possível guardar as configurações." }, { status: 500 });
  }
}
