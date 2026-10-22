import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, body, fail } from "@/lib/mikrotik-http";
import { decrypt, hash, safeResult, safeSnapshot, token } from "@/lib/mikrotik-security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    if (process.env.VERCEL_ENV === 'preview') throw new ApiError(403, 'Agentes devem usar a URL de produção.');
    const bearer = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.get("authorization") || "");
    if (!bearer) throw new ApiError(401, "Agente não autorizado.");
    const router = await prisma.mikrotikRouter.findUnique({ where: { agentTokenHash: hash(bearer[1]), enabled: true } });
    if (!router) throw new ApiError(401, "Agente não autorizado.");
    const active = await prisma.organization.count({ where: { id: router.organizationId, status: "active" } });
    if (!active) throw new ApiError(403, "Empresa inativa.");
    const b = await body(req);
    if (b.type === "ack") {
      const result = safeResult(b.result);
      await prisma.$transaction(async tx => {
        const job = await tx.mikrotikJob.findFirst({ where: { id: String(b.jobId || ""), routerId: router.id, organizationId: router.organizationId, leaseTokenHash: hash(String(b.lease || "")) } });
        if (!job) throw new ApiError(409, "Confirmação inválida.");
        if (job.completedAt) return;
        const command = decrypt(job.payloadCipher);
        await tx.mikrotikJob.update({ where: { id: job.id }, data: { status: result.ok ? "SUCCEEDED" : result.code === "OWNERSHIP_CONFLICT" ? "FAILED" : "UNKNOWN", result, payloadCipher: "", completedAt: new Date() } });
        if (job.subscriberId) {
          const state = result.ok ? (job.action === "SUSPEND" ? "SUSPENDED" : ["PROVISION", "REACTIVATE"].includes(job.action) ? "ACTIVE" : undefined) : undefined;
          await tx.mikrotikSubscriber.updateMany({ where: { id: job.subscriberId, organizationId: router.organizationId }, data: { ...(state ? { authStatus: state } : {}), ...(result.ok && job.action === "PLAN" ? { planId: command.planId, profile: command.profile } : {}) } });
        }
        await tx.auditEvent.create({ data: { organizationId: router.organizationId, actorUserId: job.actorUserId.startsWith('system:') ? null : job.actorUserId, action: result.ok ? "MIKROTIK_CONFIRMED" : "MIKROTIK_FAILED", entityType: "MikrotikJob", entityId: job.id, details: { operation: job.action, code: result.code, routerId: router.id } } });
      });
      return NextResponse.json({ ok: true });
    }
    if (b.type !== "poll") throw new ApiError(400, "Mensagem não permitida.");
    const snapshot = b.snapshot === undefined ? undefined : safeSnapshot(b.snapshot);
    await prisma.mikrotikRouter.update({ where: { id: router.id }, data: { lastSeenAt: new Date(), ...(snapshot ? { snapshot, snapshotAt: new Date(), routerOnline: snapshot.online } : {}) } });
    const lease = token();
    const job = await prisma.$transaction(async tx => {
      // Serializa claims do mesmo roteador mesmo com duas instâncias do agente.
      await tx.$queryRaw`SELECT id FROM "MikrotikRouter" WHERE id = ${router.id} FOR UPDATE`;
      await tx.mikrotikJob.updateMany({ where: { routerId: router.id, status: "PENDING", expiresAt: { lt: new Date() } }, data: { status: "EXPIRED", payloadCipher: "", completedAt: new Date() } });
      await tx.mikrotikJob.updateMany({ where: { routerId: router.id, status: "RUNNING", claimedAt: { lt: new Date(Date.now() - 120000) } }, data: { status: "UNKNOWN" } });
      if (await tx.mikrotikJob.count({ where: { routerId: router.id, status: { in: ["RUNNING", "UNKNOWN"] } } })) return null;
      const next = await tx.mikrotikJob.findFirst({ where: { routerId: router.id, organizationId: router.organizationId, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "asc" } });
      if (!next) return null;
      // Sem dados reais online, não executar comandos acumulados.
      const current = await tx.mikrotikRouter.findUniqueOrThrow({ where: { id: router.id } });
      if (!current.routerOnline || !current.snapshotAt || Date.now() - current.snapshotAt.getTime() > 90000) return null;
      const payload = decrypt(next.payloadCipher);
      await tx.mikrotikJob.update({ where: { id: next.id }, data: { status: "RUNNING", claimedAt: new Date(), leaseTokenHash: hash(lease) } });
      return { id: next.id, action: next.action, payload, lease };
    });
    return NextResponse.json({ job, pollSeconds: 10 }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
