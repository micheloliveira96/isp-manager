import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const tireStatuses = ["GOOD", "ATTENTION", "REPLACE", "UNKNOWN"];
const vehicleStatuses = ["ACTIVE", "MAINTENANCE", "INACTIVE"];
function dateValue(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}
function plateValue(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const [vehicles, technicians] = await Promise.all([
    prisma.fleetVehicle.findMany({ where: { organizationId: session.organizationId }, include: { driver: { select: { id: true, name: true, phone: true } }, inventoryAssignments: { where: { status: "ASSIGNED" }, include: { product: { select: { id: true, name: true, unit: true } } } } }, orderBy: { plate: "asc" } }),
    prisma.technician.findMany({ where: { organizationId: session.organizationId, active: true }, select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } })
  ]);
  return NextResponse.json({ vehicles, technicians });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Somente administradores podem gerenciar a frota." }, { status: 403 });
  try {
    const body = await request.json();
    const plate = plateValue(body.plate);
    const model = String(body.model || "").trim().slice(0, 100);
    const brand = String(body.brand || "").trim().slice(0, 80) || null;
    const year = body.year ? Number(body.year) : null;
    const driverTechnicianId = String(body.driverTechnicianId || "") || null;
    const ipvaDueDate = dateValue(body.ipvaDueDate);
    const lastOilChangeDate = dateValue(body.lastOilChangeDate);
    const lastOilChangeKm = body.lastOilChangeKm === "" || body.lastOilChangeKm == null ? null : Number(body.lastOilChangeKm);
    const odometerKm = body.odometerKm === "" || body.odometerKm == null ? null : Number(body.odometerKm);
    const tireStatus = tireStatuses.includes(body.tireStatus) ? body.tireStatus : "UNKNOWN";
    if (plate.length < 7 || plate.length > 8) return NextResponse.json({ error: "Informe uma placa válida, com 7 ou 8 caracteres." }, { status: 400 });
    if (model.length < 2) return NextResponse.json({ error: "Informe o modelo do veículo." }, { status: 400 });
    if (year !== null && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1)) return NextResponse.json({ error: "Informe um ano de fabricação válido." }, { status: 400 });
    if (ipvaDueDate === undefined || lastOilChangeDate === undefined) return NextResponse.json({ error: "Uma das datas informadas é inválida." }, { status: 400 });
    if ((lastOilChangeKm !== null && (!Number.isInteger(lastOilChangeKm) || lastOilChangeKm < 0)) || (odometerKm !== null && (!Number.isInteger(odometerKm) || odometerKm < 0))) return NextResponse.json({ error: "A quilometragem deve ser um número inteiro maior ou igual a zero." }, { status: 400 });
    if (driverTechnicianId && !await prisma.technician.findFirst({ where: { id: driverTechnicianId, organizationId: session.organizationId, active: true } })) return NextResponse.json({ error: "O motorista selecionado não foi encontrado." }, { status: 400 });
    const vehicle = await prisma.fleetVehicle.create({ data: { organizationId: session.organizationId, plate, model, brand, year, driverTechnicianId, ipvaDueDate, tireStatus, lastOilChangeDate, lastOilChangeKm, odometerKm, notes: String(body.notes || "").trim().slice(0, 2000) || null }, include: { driver: { select: { id: true, name: true, phone: true } } } });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "CREATE", entityType: "FleetVehicle", entityId: vehicle.id, details: { plate, model } } });
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Já existe um veículo cadastrado com essa placa." }, { status: 409 });
    console.error("Create fleet vehicle failed", error);
    return NextResponse.json({ error: "Não foi possível cadastrar o veículo." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Somente administradores podem gerenciar a frota." }, { status: 403 });
  try {
    const body = await request.json();
    const id = String(body.id || "");
    const existing = await prisma.fleetVehicle.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!existing) return NextResponse.json({ error: "Veículo não encontrado." }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (body.plate !== undefined) {
      const plate = plateValue(body.plate);
      if (plate.length < 7 || plate.length > 8) return NextResponse.json({ error: "Informe uma placa válida, com 7 ou 8 caracteres." }, { status: 400 });
      data.plate = plate;
    }
    if (body.brand !== undefined) data.brand = String(body.brand || "").trim().slice(0, 80) || null;
    if (body.model !== undefined) {
      const model = String(body.model || "").trim().slice(0, 100);
      if (model.length < 2) return NextResponse.json({ error: "Informe o modelo do veículo." }, { status: 400 });
      data.model = model;
    }
    if (body.year !== undefined) {
      const year = body.year === "" || body.year == null ? null : Number(body.year);
      if (year !== null && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1)) return NextResponse.json({ error: "Informe um ano de fabricação válido." }, { status: 400 });
      data.year = year;
    }
    if (body.driverTechnicianId !== undefined) {
      const driverId = String(body.driverTechnicianId || "") || null;
      if (driverId && !await prisma.technician.findFirst({ where: { id: driverId, organizationId: session.organizationId, active: true } })) return NextResponse.json({ error: "O motorista selecionado não foi encontrado." }, { status: 400 });
      data.driverTechnicianId = driverId;
    }
    for (const key of ["ipvaDueDate", "lastOilChangeDate"] as const) if (body[key] !== undefined) {
      const date = dateValue(body[key]);
      if (date === undefined) return NextResponse.json({ error: "Uma das datas informadas é inválida." }, { status: 400 });
      data[key] = date;
    }
    for (const key of ["lastOilChangeKm", "odometerKm"] as const) if (body[key] !== undefined) {
      const value = body[key] === "" || body[key] == null ? null : Number(body[key]);
      if (value !== null && (!Number.isInteger(value) || value < 0)) return NextResponse.json({ error: "A quilometragem deve ser um número inteiro maior ou igual a zero." }, { status: 400 });
      data[key] = value;
    }
    if (body.tireStatus !== undefined) {
      if (!tireStatuses.includes(body.tireStatus)) return NextResponse.json({ error: "Situação dos pneus inválida." }, { status: 400 });
      data.tireStatus = body.tireStatus;
    }
    if (body.status !== undefined) {
      if (!vehicleStatuses.includes(body.status)) return NextResponse.json({ error: "Status do veículo inválido." }, { status: 400 });
      data.status = body.status;
    }
    if (body.notes !== undefined) data.notes = String(body.notes || "").trim().slice(0, 2000) || null;
    const vehicle = await prisma.fleetVehicle.update({ where: { id }, data, include: { driver: { select: { id: true, name: true, phone: true } }, inventoryAssignments: { where: { status: "ASSIGNED" }, include: { product: { select: { id: true, name: true, unit: true } } } } } });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "UPDATE", entityType: "FleetVehicle", entityId: id, details: { updatedFields: Object.keys(data) } } });
    return NextResponse.json({ vehicle });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Já existe um veículo cadastrado com essa placa." }, { status: 409 });
    console.error("Update fleet vehicle failed", error);
    return NextResponse.json({ error: "Não foi possível atualizar o veículo." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Somente administradores podem gerenciar a frota." }, { status: 403 });
  try {
    const body = await request.json();
    const id = String(body.id || "");
    const updated = await prisma.fleetVehicle.updateMany({ where: { id, organizationId: session.organizationId, status: { not: "INACTIVE" } }, data: { status: "INACTIVE" } });
    if (!updated.count) return NextResponse.json({ error: "Veículo não encontrado ou já inativo." }, { status: 404 });
    await prisma.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "DEACTIVATE", entityType: "FleetVehicle", entityId: id, details: {} } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Deactivate fleet vehicle failed", error);
    return NextResponse.json({ error: "Não foi possível desativar o veículo." }, { status: 500 });
  }
}
