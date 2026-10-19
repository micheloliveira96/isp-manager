import { NextRequest, NextResponse } from "next/server";
import { getSession, canManageOrders } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  const where = session.role === "TECHNICIAN" ? { organizationId: session.organizationId, assignedTeam: session.name } : { organizationId: session.organizationId };
  const orders = await prisma.serviceOrder.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (!canManageOrders(session.role)) return NextResponse.json({ error: "Não tens permissão para criar ordens." }, { status: 403 });
  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    const customerName = String(body.customerName || "").trim();
    if (!title || !customerName || title.length > 140 || customerName.length > 140) return NextResponse.json({ error: "Preenche o serviço e o nome do cliente." }, { status: 400 });
    const last = await prisma.serviceOrder.count({ where: { organizationId: session.organizationId } });
    const code = "OS-" + new Date().getFullYear() + "-" + String(last + 1).padStart(4, "0");
    const order = await prisma.serviceOrder.create({ data: { organizationId: session.organizationId, code, title, customerName, address: String(body.address || "").slice(0, 240) || null, description: String(body.description || "").slice(0, 2000) || null, priority: ["LOW", "NORMAL", "HIGH", "URGENT"].includes(body.priority) ? body.priority : "NORMAL", status: "OPEN", assignedTeam: String(body.assignedTeam || "").slice(0, 100) || null, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, createdById: session.userId } });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "CREATE", entityType: "ServiceOrder", entityId: order.id, details: { code, title, customerName } } });
    return NextResponse.json({ order }, { status: 201 });
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
    const existing = await prisma.serviceOrder.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!existing) return NextResponse.json({ error: "Ordem não encontrada." }, { status: 404 });
    if (session.role === "TECHNICIAN") {
      if (existing.assignedTeam !== session.name || !["IN_PROGRESS", "REVIEW"].includes(status)) return NextResponse.json({ error: "Não tens permissão para esta alteração." }, { status: 403 });
    } else if (!canManageOrders(session.role) && status !== "REVIEW") {
      return NextResponse.json({ error: "Não tens permissão para alterar ordens." }, { status: 403 });
    }
    const order = await prisma.serviceOrder.update({ where: { id }, data: { status, completedAt: status === "COMPLETED" ? new Date() : null } });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "UPDATE_STATUS", entityType: "ServiceOrder", entityId: id, details: { from: existing.status, to: status } } });
    return NextResponse.json({ order });
  } catch (error) {
    console.error("Update order failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar a ordem." }, { status: 500 });
  }
}
