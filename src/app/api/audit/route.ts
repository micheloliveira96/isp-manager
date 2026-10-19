import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (session.role !== "MANAGER") return NextResponse.json({ error: "Apenas o gestor pode consultar a auditoria." }, { status: 403 });
  const events = await prisma.auditEvent.findMany({ where: { organizationId: session.organizationId }, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ events });
}
