import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  const [technicians, teams] = await Promise.all([
    prisma.technician.findMany({ where: { organizationId: session.organizationId, active: true }, include: { team: { select: { id: true, name: true } } }, orderBy: { name: "asc" } }),
    prisma.serviceTeam.findMany({ where: { organizationId: session.organizationId, active: true }, include: { technicians: { where: { active: true }, select: { id: true, name: true, phone: true, email: true } } }, orderBy: { name: "asc" } })
  ]);
  return NextResponse.json({ technicians, teams });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Apenas o administrador pode gerenciar técnicos e equipes." }, { status: 403 });
  try {
    const body = await request.json();
    const kind = body.kind === "team" ? "team" : "technician";
    const name = String(body.name || "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "O nome deve ter entre 2 e 100 caracteres." }, { status: 400 });
    if (kind === "team") {
      const team = await prisma.serviceTeam.create({ data: { organizationId: session.organizationId, name } });
      await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "CREATE", entityType: "ServiceTeam", entityId: team.id, details: { name } } });
      return NextResponse.json({ team }, { status: 201 });
    }
    const teamId = String(body.teamId || "").trim() || null;
    if (teamId && !await prisma.serviceTeam.findFirst({ where: { id: teamId, organizationId: session.organizationId, active: true } })) return NextResponse.json({ error: "A equipe selecionada não existe." }, { status: 400 });
    const email = String(body.email || "").trim().toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Indica um email válido." }, { status: 400 });
    const technician = await prisma.technician.create({ data: { organizationId: session.organizationId, name, address: String(body.address || "").trim().slice(0, 240) || null, phone: String(body.phone || "").trim().slice(0, 40) || null, email: email || null, notes: String(body.notes || "").trim().slice(0, 1000) || null, teamId } , include: { team: { select: { id: true, name: true } } } });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "CREATE", entityType: "Technician", entityId: technician.id, details: { name, teamId } } });
    return NextResponse.json({ technician }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Já existe um registro com esse nome." }, { status: 409 });
    console.error("Create technician/team failed", error);
    return NextResponse.json({ error: "Não foi possível salvar o registro." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Apenas o administrador pode gerenciar técnicos e equipes." }, { status: 403 });
  try {
    const body = await request.json();
    const id = String(body.id || "");
    const teamId = String(body.teamId || "").trim() || null;
    const technician = await prisma.technician.findFirst({ where: { id, organizationId: session.organizationId, active: true } });
    if (!technician) return NextResponse.json({ error: "Técnico não encontrado." }, { status: 404 });
    if (teamId && !await prisma.serviceTeam.findFirst({ where: { id: teamId, organizationId: session.organizationId, active: true } })) return NextResponse.json({ error: "A equipe selecionada não existe." }, { status: 400 });
    const updated = await prisma.technician.update({ where: { id }, data: { teamId }, include: { team: { select: { id: true, name: true } } } });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "ASSIGN_TECHNICIAN_TEAM", entityType: "Technician", entityId: id, details: { teamId } } });
    return NextResponse.json({ technician: updated });
  } catch (error) {
    console.error("Assign technician failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar a equipe do técnico." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Apenas o administrador pode gerenciar técnicos e equipes." }, { status: 403 });
  try {
    const body = await request.json();
    const id = String(body.id || "");
    const updated = await prisma.technician.updateMany({ where: { id, organizationId: session.organizationId, active: true }, data: { active: false, teamId: null } });
    if (!updated.count) return NextResponse.json({ error: "Técnico não encontrado." }, { status: 404 });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "DEACTIVATE", entityType: "Technician", entityId: id, details: {} } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Deactivate technician failed", error);
    return NextResponse.json({ error: "Não foi possível desativar o técnico." }, { status: 500 });
  }
}