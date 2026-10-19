import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  const [teams, serviceTypes] = await Promise.all([
    prisma.serviceTeam.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { name: "asc" } }),
    prisma.serviceType.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { name: "asc" } })
  ]);
  return NextResponse.json({ teams, serviceTypes });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Apenas o gestor pode gerir estes parâmetros." }, { status: 403 });
  try {
    const body = await request.json();
    const kind = body.kind === "team" ? "team" : body.kind === "serviceType" ? "serviceType" : "";
    const name = String(body.name || "").trim().replace(/\s+/g, " ");
    if (!kind || name.length < 2 || name.length > 100) return NextResponse.json({ error: "Indica um nome com 2 a 100 caracteres." }, { status: 400 });
    const model = kind === "team" ? prisma.serviceTeam : prisma.serviceType;
    const item = await model.create({ data: { organizationId: session.organizationId, name } });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "CREATE", entityType: kind === "team" ? "ServiceTeam" : "ServiceType", entityId: item.id, details: { name } } });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Já existe um parâmetro com esse nome." }, { status: 409 });
    console.error("Create order setting failed", error);
    return NextResponse.json({ error: "Não foi possível guardar o parâmetro." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Apenas o gestor pode gerir estes parâmetros." }, { status: 403 });
  try {
    const body = await request.json();
    const kind = body.kind === "team" ? "team" : body.kind === "serviceType" ? "serviceType" : "";
    const id = String(body.id || "");
    if (!kind || !id) return NextResponse.json({ error: "Parâmetro inválido." }, { status: 400 });
    const model = kind === "team" ? prisma.serviceTeam : prisma.serviceType;
    const item = await model.updateMany({ where: { id, organizationId: session.organizationId, active: true }, data: { active: false } });
    if (!item.count) return NextResponse.json({ error: "Parâmetro não encontrado." }, { status: 404 });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "DEACTIVATE", entityType: kind === "team" ? "ServiceTeam" : "ServiceType", entityId: id, details: {} } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Deactivate order setting failed", error);
    return NextResponse.json({ error: "Não foi possível desativar o parâmetro." }, { status: 500 });
  }
}
