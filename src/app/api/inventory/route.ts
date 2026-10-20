import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const categories = ["ONU", "ONT", "ROUTER", "DROP_CABLE_BOX", "FIBER_CABLE_BOX", "CABLE", "CONNECTOR", "TOOLS", "OTHER"];
const units = ["UN", "CAIXA", "METRO", "ROLO", "PACOTE"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const [products, assignments, technicians, teams, vehicles] = await Promise.all([
    prisma.inventoryProduct.findMany({ where: { organizationId: session.organizationId, active: true }, orderBy: { name: "asc" } }),
    prisma.inventoryAssignment.findMany({ where: { organizationId: session.organizationId, status: "ASSIGNED" }, include: { product: { select: { id: true, name: true, category: true, unit: true } }, technician: { select: { id: true, name: true } }, team: { select: { id: true, name: true } }, vehicle: { select: { id: true, plate: true, model: true } } }, orderBy: { assignedAt: "desc" } }),
    prisma.technician.findMany({ where: { organizationId: session.organizationId, active: true }, select: { id: true, name: true, teamId: true }, orderBy: { name: "asc" } }),
    prisma.serviceTeam.findMany({ where: { organizationId: session.organizationId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.fleetVehicle.findMany({ where: { organizationId: session.organizationId, status: "ACTIVE" }, select: { id: true, plate: true, model: true }, orderBy: { plate: "asc" } })
  ]);
  return NextResponse.json({ products, assignments, technicians, teams, vehicles });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Somente administradores podem gerenciar o estoque." }, { status: 403 });
  try {
    const body = await request.json();
    const action = String(body.action || "product");
    if (action === "product") {
      const name = String(body.name || "").trim().replace(/\s+/g, " ");
      const category = categories.includes(body.category) ? body.category : "OTHER";
      const unit = units.includes(body.unit) ? body.unit : "UN";
      const quantityOnHand = Number(body.quantityOnHand);
      const minQuantity = Number(body.minQuantity || 0);
      const sku = String(body.sku || "").trim().toUpperCase() || null;
      if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Informe o nome do produto (2 a 120 caracteres)." }, { status: 400 });
      if (!Number.isInteger(quantityOnHand) || quantityOnHand < 0 || !Number.isInteger(minQuantity) || minQuantity < 0) return NextResponse.json({ error: "As quantidades devem ser números inteiros iguais ou maiores que zero." }, { status: 400 });
      const product = await prisma.inventoryProduct.create({ data: { organizationId: session.organizationId, name, category, unit, quantityOnHand, minQuantity, sku, notes: String(body.notes || "").trim().slice(0, 1000) || null } });
      await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "CREATE", entityType: "InventoryProduct", entityId: product.id, details: { name, category, quantityOnHand } } });
      return NextResponse.json({ product }, { status: 201 });
    }
    if (action === "restock") {
      const productId = String(body.productId || "");
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) return NextResponse.json({ error: "Informe uma quantidade maior que zero." }, { status: 400 });
      const updated = await prisma.inventoryProduct.updateMany({ where: { id: productId, organizationId: session.organizationId, active: true }, data: { quantityOnHand: { increment: quantity } } });
      if (!updated.count) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
      const product = await prisma.inventoryProduct.findFirst({ where: { id: productId, organizationId: session.organizationId } });
      await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "RESTOCK", entityType: "InventoryProduct", entityId: productId, details: { quantity } } });
      return NextResponse.json({ product });
    }
    if (action === "assign") {
      const productId = String(body.productId || "");
      const quantity = Number(body.quantity);
      const technicianId = String(body.technicianId || "") || null;
      const teamId = String(body.teamId || "") || null;
      const vehicleId = String(body.vehicleId || "") || null;
      if (!Number.isInteger(quantity) || quantity < 1) return NextResponse.json({ error: "Informe uma quantidade maior que zero." }, { status: 400 });
      if (!technicianId && !teamId && !vehicleId) return NextResponse.json({ error: "Selecione um técnico, uma equipe ou um veículo para associar o material." }, { status: 400 });
      const [product, technician, team, vehicle] = await Promise.all([
        prisma.inventoryProduct.findFirst({ where: { id: productId, organizationId: session.organizationId, active: true } }),
        technicianId ? prisma.technician.findFirst({ where: { id: technicianId, organizationId: session.organizationId, active: true } }) : Promise.resolve(null),
        teamId ? prisma.serviceTeam.findFirst({ where: { id: teamId, organizationId: session.organizationId, active: true } }) : Promise.resolve(null),
        vehicleId ? prisma.fleetVehicle.findFirst({ where: { id: vehicleId, organizationId: session.organizationId, status: "ACTIVE" } }) : Promise.resolve(null)
      ]);
      if (!product) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
      if ((technicianId && !technician) || (teamId && !team) || (vehicleId && !vehicle)) return NextResponse.json({ error: "Um dos destinos selecionados não existe ou está inativo." }, { status: 400 });
      const result = await prisma.$transaction(async (tx) => {
        const stock = await tx.inventoryProduct.updateMany({ where: { id: productId, organizationId: session.organizationId, active: true, quantityOnHand: { gte: quantity } }, data: { quantityOnHand: { decrement: quantity } } });
        if (!stock.count) throw new Error("ESTOQUE_INSUFICIENTE");
        return tx.inventoryAssignment.create({ data: { organizationId: session.organizationId, productId, quantity, technicianId, teamId, vehicleId, notes: String(body.notes || "").trim().slice(0, 1000) || null }, include: { product: { select: { id: true, name: true, category: true, unit: true } }, technician: { select: { id: true, name: true } }, team: { select: { id: true, name: true } }, vehicle: { select: { id: true, plate: true, model: true } } } });
      });
      await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "ASSIGN_STOCK", entityType: "InventoryAssignment", entityId: result.id, details: { productId, quantity, technicianId, teamId, vehicleId } } });
      return NextResponse.json({ assignment: result }, { status: 201 });
    }
    return NextResponse.json({ error: "Ação de estoque inválida." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "ESTOQUE_INSUFICIENTE") return NextResponse.json({ error: "Estoque insuficiente para essa saída." }, { status: 409 });
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Já existe um produto com esse código SKU." }, { status: 409 });
    console.error("Inventory operation failed", error);
    return NextResponse.json({ error: "Não foi possível concluir a operação de estoque." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Somente administradores podem gerenciar o estoque." }, { status: 403 });
  try {
    const body = await request.json();
    const id = String(body.id || "");
    const assignment = await prisma.inventoryAssignment.findFirst({ where: { id, organizationId: session.organizationId, status: "ASSIGNED" } });
    if (!assignment) return NextResponse.json({ error: "Material associado não encontrado." }, { status: 404 });
    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.inventoryAssignment.updateMany({ where: { id, organizationId: session.organizationId, status: "ASSIGNED" }, data: { status: "RETURNED", returnedAt: new Date() } });
      if (!changed.count) throw new Error("ASSIGNMENT_ALREADY_RETURNED");
      await tx.inventoryProduct.updateMany({ where: { id: assignment.productId, organizationId: session.organizationId }, data: { quantityOnHand: { increment: assignment.quantity } } });
      return tx.inventoryAssignment.findUnique({ where: { id }, include: { product: { select: { id: true, name: true } } } });
    });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "RETURN_STOCK", entityType: "InventoryAssignment", entityId: id, details: { productId: assignment.productId, quantity: assignment.quantity } } });
    return NextResponse.json({ assignment: result });
  } catch (error) {
    if (error instanceof Error && error.message === "ASSIGNMENT_ALREADY_RETURNED") return NextResponse.json({ error: "Esse material já foi devolvido." }, { status: 409 });
    console.error("Inventory return failed", error);
    return NextResponse.json({ error: "Não foi possível registrar a devolução." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Somente administradores podem gerenciar o estoque." }, { status: 403 });
  const body = await request.json();
  const id = String(body.id || "");
  const updated = await prisma.inventoryProduct.updateMany({ where: { id, organizationId: session.organizationId, active: true }, data: { active: false } });
  if (!updated.count) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "DEACTIVATE", entityType: "InventoryProduct", entityId: id, details: {} } });
  return NextResponse.json({ success: true });
}
