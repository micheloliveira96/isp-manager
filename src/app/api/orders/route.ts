import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (!(await hasPermission(session, "orders.view"))) return NextResponse.json({ error: "Não tem permissão para consultar ordens." }, { status: 403 });
  let where: any = { organizationId: session.organizationId };
  if (session.role === "TECHNICIAN") {
    const technician = await prisma.technician.findFirst({ where: { organizationId: session.organizationId, active: true, email: { equals: session.email, mode: "insensitive" } }, include: { team: { select: { name: true } } } });
    const assignedNames = [session.name, technician?.team?.name].filter(Boolean);
    where = { organizationId: session.organizationId, assignedTeam: { in: assignedNames } };
  }
  const orders = await prisma.serviceOrder.findMany({ where, select: { id: true, code: true, title: true, customerName: true, pppoeUsername: true, pppoePassword: true, address: true, description: true, priority: true, status: true, assignedTeam: true, scheduledAt: true, technology: true, ponPort: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ orders: orders.map((order) => ({ ...order, phone: null })) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (!(await hasPermission(session, "orders.create"))) return NextResponse.json({ error: "Não tem permissão para criar ordens." }, { status: 403 });
  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    const technology = ["GPON", "EPON"].includes(body.technology) ? body.technology : null;
    const ponPort = String(body.ponPort || "").trim().slice(0, 100) || null;
    const customerName = String(body.customerName || "").trim();
    // The production database currently lacks ServiceOrder.phone; omit it until the schema is migrated.
    const pppoeUsername = String(body.pppoeUsername || "").trim().slice(0, 160) || null;
    const pppoePassword = String(body.pppoePassword || "").slice(0, 200) || null;
    if (!title || !customerName || title.length > 140 || customerName.length > 140 || !technology) return NextResponse.json({ error: "Preenche o serviço e o nome do cliente." }, { status: 400 });
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const code = "OS-" + new Date().getFullYear() + "-" + stamp + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const order = await prisma.serviceOrder.create({ data: { organizationId: session.organizationId, code, title, customerName, pppoeUsername, pppoePassword, address: String(body.address || "").slice(0, 240) || null, description: String(body.description || "").slice(0, 2000) || null, priority: ["LOW", "NORMAL", "HIGH", "URGENT"].includes(body.priority) ? body.priority : "NORMAL", status: "OPEN", assignedTeam: String(body.assignedTeam || "").slice(0, 100) || null, technology, ponPort, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, createdById: session.userId } });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "CREATE", entityType: "ServiceOrder", entityId: order.id, details: { code, title, customerName, pppoeUsername, pppoePasswordProvided: Boolean(pppoePassword) } } });
    const { pppoePassword: _hiddenPassword, ...safeOrder } = order;
    return NextResponse.json({ order: { ...safeOrder, phone: null } }, { status: 201 });
  } catch (error) {
    console.error("Create order failed", error);
    return NextResponse.json({ error: "Não foi possível criar a ordem de serviço." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  try {
    const body = await request.json();
    const id = String(body.id || "");
    const status = String(body.status || "");
    if (!id || !["OPEN", "SCHEDULED", "IN_PROGRESS", "REVIEW", "COMPLETED", "CANCELLED"].includes(status)) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
    const existing = await prisma.serviceOrder.findFirst({ where: { id, organizationId: session.organizationId }, select: { id: true, status: true, assignedTeam: true } });
    if (!existing) return NextResponse.json({ error: "Ordem não encontrada." }, { status: 404 });
    if (!(await hasPermission(session, "orders.update"))) return NextResponse.json({ error: "Não tem permissão para atualizar ordens." }, { status: 403 });
    if (status === "COMPLETED" && !(await hasPermission(session, "orders.approve"))) return NextResponse.json({ error: "A aprovação final exige permissão específica." }, { status: 403 });
    if (session.role === "TECHNICIAN") {
      const technician = await prisma.technician.findFirst({ where: { organizationId: session.organizationId, active: true, email: { equals: session.email, mode: "insensitive" } }, include: { team: { select: { name: true } } } });
      const assignedNames = [session.name, technician?.team?.name].filter(Boolean);
      if (!assignedNames.includes(existing.assignedTeam || "") || !["IN_PROGRESS", "REVIEW"].includes(status)) return NextResponse.json({ error: "Só podes atualizar ordens atribuídas a ti ou à tua equipa para execução ou análise." }, { status: 403 });
    }
    const order = await prisma.serviceOrder.update({ where: { id }, data: { status, completedAt: status === "COMPLETED" ? new Date() : null }, select: { id: true, code: true, title: true, customerName: true, pppoeUsername: true, address: true, description: true, priority: true, status: true, assignedTeam: true, scheduledAt: true, technology: true, ponPort: true, createdAt: true } });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "UPDATE_STATUS", entityType: "ServiceOrder", entityId: id, details: { from: existing.status, to: status } } });
    return NextResponse.json({ order: { ...order, phone: null } });
  } catch (error) {
    console.error("Update order failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar a ordem." }, { status: 500 });
  }
}
