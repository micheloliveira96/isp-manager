import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Inicia sessão para continuar." }, { status: 401 });
  if (session.role !== "TECHNICIAN") return NextResponse.json({ error: "Esta área é exclusiva para técnicos." }, { status: 403 });

  const technician = await prisma.technician.findFirst({
    where: { organizationId: session.organizationId, userId: session.userId, active: true },
    select: { id: true, name: true, phone: true, team: { select: { name: true } } }
  });
  if (!technician) return NextResponse.json({ error: "O teu utilizador ainda não está associado a um cadastro de técnico. Pede ao administrador para configurar o acesso." }, { status: 403 });

  const orders = await prisma.serviceOrder.findMany({
    where: { organizationId: session.organizationId, assignedTechnicianId: technician.id },
    select: { id: true, code: true, title: true, customerName: true, phone: true, address: true, description: true, priority: true, status: true, scheduledAt: true, completedAt: true },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 200
  });
  return NextResponse.json({ technician, orders });
}
