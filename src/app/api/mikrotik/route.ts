import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { access, ApiError, body, fail } from "@/lib/mikrotik-http";
import { fresh, hash, OFFLINE_MESSAGE, token } from "@/lib/mikrotik-security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const s = await access("mikrotik.view");
    const [routers, subscribers, jobs, clients, plans] = await Promise.all([
      prisma.mikrotikRouter.findMany({ where: { organizationId: s.organizationId }, select: { id: true, name: true, enabled: true, routerOnline: true, lastSeenAt: true, snapshotAt: true, snapshot: true }, orderBy: { name: "asc" } }),
      prisma.mikrotikSubscriber.findMany({ where: { organizationId: s.organizationId }, select: { id: true, routerId: true, clientId: true, planId: true, username: true, profile: true, authStatus: true, managedLifecycle: true, client: { select: { name: true, status: true } }, plan: { select: { name: true } } }, take: 1000 }),
      prisma.mikrotikJob.findMany({ where: { organizationId: s.organizationId }, select: { id: true, routerId: true, subscriberId: true, action: true, status: true, result: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.client.findMany({ where: { organizationId: s.organizationId }, select: { id: true, name: true, number: true }, orderBy: { name: "asc" }, take: 1000 }),
      prisma.internetPlan.findMany({ where: { organizationId: s.organizationId, active: true }, select: { id: true, name: true, downloadMbps: true, uploadMbps: true }, orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ routers: routers.map(r => { const online = r.enabled && r.routerOnline && fresh(r.lastSeenAt) && fresh(r.snapshotAt); return { ...r, online, snapshot: online ? r.snapshot : null, message: online ? "Conectado ao MikroTik" : OFFLINE_MESSAGE }; }), subscribers, jobs, clients, plans, financialAutomationEnabled: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try {
    const s = await access("mikrotik.manage", req), b = await body(req);
    const label = String(b.name || "").trim();
    if (label.length < 2 || label.length > 80) throw new ApiError(400, "Nome deve ter de 2 a 80 caracteres.");
    const agentToken = token();
    const router = await prisma.$transaction(async tx => {
      const r = await tx.mikrotikRouter.create({ data: { organizationId: s.organizationId, name: label, agentTokenHash: hash(agentToken) }, select: { id: true, name: true } });
      await tx.auditEvent.create({ data: { organizationId: s.organizationId, actorUserId: s.userId, action: "MIKROTIK_ROUTER_CREATED", entityType: "MikrotikRouter", entityId: r.id } });
      return r;
    });
    return NextResponse.json({ router, agentToken }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
export async function PATCH(req: NextRequest) {
  try {
    const s = await access("mikrotik.manage", req), b = await body(req), agentToken = token();
    if (b.operation !== "rotate" && b.operation !== "disable") throw new ApiError(400, "Operação inválida.");
    await prisma.$transaction(async tx => {
      const result = await tx.mikrotikRouter.updateMany({ where: { id: String(b.routerId || ""), organizationId: s.organizationId }, data: b.operation === "rotate" ? { agentTokenHash: hash(agentToken), enabled: true } : { enabled: false, routerOnline: false } });
      if (!result.count) throw new ApiError(404, "Roteador não encontrado.");
      await tx.auditEvent.create({ data: { organizationId: s.organizationId, actorUserId: s.userId, action: b.operation === "rotate" ? "MIKROTIK_TOKEN_ROTATED" : "MIKROTIK_AGENT_DISABLED", entityType: "MikrotikRouter", entityId: String(b.routerId) } });
    });
    return NextResponse.json({ ok: true, ...(b.operation === "rotate" ? { agentToken } : {}) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
