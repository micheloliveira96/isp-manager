import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const [vehicles, technicians, refills] = await Promise.all([
    prisma.fleetVehicle.findMany({ where: { organizationId: session.organizationId }, select: { id: true, plate: true, brand: true, model: true, odometerKm: true }, orderBy: { plate: "asc" } }),
    prisma.technician.findMany({ where: { organizationId: session.organizationId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.fuelRefill.findMany({ where: { organizationId: session.organizationId }, include: { vehicle: { select: { id: true, plate: true, brand: true, model: true } }, technician: { select: { id: true, name: true } } }, orderBy: { refilledAt: "desc" }, take: 500 })
  ]);
  const total = refills.reduce((sum, r) => sum + Number(r.totalCost), 0);
  const byVehicle = vehicles.map(v => {
    const entries = refills.filter(r => r.vehicleId === v.id);
    return { ...v, totalCost: entries.reduce((sum, r) => sum + Number(r.totalCost), 0), refillCount: entries.length, lastRefill: entries[0] || null };
  });
  return NextResponse.json({ vehicles, technicians, refills, summary: { totalCost: total, count: refills.length, liters: refills.reduce((sum, r) => sum + Number(r.liters || 0), 0), byVehicle } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Somente administradores podem registar abastecimentos." }, { status: 403 });
  try {
    const body = await request.json();
    const vehicleId = String(body.vehicleId || "");
    const odometerKm = Number(body.odometerKm);
    const totalCost = Number(body.totalCost);
    const liters = body.liters === "" || body.liters == null ? null : Number(body.liters);
    const refilledAt = body.refilledAt ? new Date(body.refilledAt) : new Date();
    const vehicle = await prisma.fleetVehicle.findFirst({ where: { id: vehicleId, organizationId: session.organizationId } });
    if (!vehicle) return NextResponse.json({ error: "Selecione um veículo válido." }, { status: 400 });
    if (!Number.isInteger(odometerKm) || odometerKm < 0) return NextResponse.json({ error: "A quilometragem deve ser um número inteiro válido." }, { status: 400 });
    if (vehicle.odometerKm != null && odometerKm < vehicle.odometerKm) return NextResponse.json({ error: `A quilometragem não pode ser inferior à última registada (${vehicle.odometerKm} km).` }, { status: 400 });
    if (!Number.isFinite(totalCost) || totalCost <= 0) return NextResponse.json({ error: "Informe um valor total válido." }, { status: 400 });
    if (liters !== null && (!Number.isFinite(liters) || liters <= 0)) return NextResponse.json({ error: "Informe uma quantidade de litros válida." }, { status: 400 });
    if (Number.isNaN(refilledAt.getTime())) return NextResponse.json({ error: "A data do abastecimento é inválida." }, { status: 400 });
    const technicianId = String(body.technicianId || "") || vehicle.driverTechnicianId || null;
    if (technicianId && !await prisma.technician.findFirst({ where: { id: technicianId, organizationId: session.organizationId } })) return NextResponse.json({ error: "Condutor não encontrado." }, { status: 400 });
    const result = await prisma.$transaction(async tx => {
      const refill = await tx.fuelRefill.create({ data: { organizationId: session.organizationId, vehicleId, technicianId, refilledAt, odometerKm, liters, totalCost, pricePerLiter: liters ? totalCost / liters : null, station: String(body.station || "").trim().slice(0, 120) || null, notes: String(body.notes || "").trim().slice(0, 1000) || null, createdById: session.userId } });
      await tx.fleetVehicle.update({ where: { id: vehicleId }, data: { odometerKm } });
      await tx.auditEvent.create({ data: { organizationId: session.organizationId, actorUserId: session.userId, action: "CREATE", entityType: "FuelRefill", entityId: refill.id, details: { vehicleId, odometerKm, totalCost } } });
      return refill;
    });
    return NextResponse.json({ refill: result }, { status: 201 });
  } catch (error) {
    console.error("Create fuel refill failed", error);
    return NextResponse.json({ error: "Não foi possível registar o abastecimento." }, { status: 500 });
  }
}
