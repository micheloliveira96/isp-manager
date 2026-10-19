import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (!(await hasPermission(session, "audit.view"))) return NextResponse.json({ error: "Não tens permissão para consultar a auditoria." }, { status: 403 });
  const events = await prisma.auditEvent.findMany({ where: { organizationId: session.organizationId }, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ events });
}
