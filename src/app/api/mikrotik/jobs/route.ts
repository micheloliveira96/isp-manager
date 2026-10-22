import { NextRequest, NextResponse } from "next/server";
import { access, body, fail } from "@/lib/mikrotik-http";
import { enqueue } from "@/lib/mikrotik-service";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/mikrotik-http";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const b = await body(req), permission = ["SUSPEND", "REACTIVATE"].includes(String(b.action)) ? "mikrotik.suspend" : "mikrotik.provision";
    const s = await access(permission, req);
    const job = await enqueue(s, b, req.headers.get("Idempotency-Key") || "");
    return NextResponse.json({ job }, { status: 202 });
  } catch (e) { return fail(e); }
}
export async function PATCH(req: NextRequest) {
  try {
    const s = await access("mikrotik.manage", req), b = await body(req);
    if (b.confirmReviewed !== true) throw new ApiError(400, "Confirme a conferência do estado real antes de liberar a fila.");
    await prisma.$transaction(async tx => {
      const changed = await tx.mikrotikJob.updateMany({ where: { id: String(b.jobId || ""), organizationId: s.organizationId, status: "UNKNOWN" }, data: { status: "REVIEWED", payloadCipher: "", completedAt: new Date() } });
      if (!changed.count) throw new ApiError(409, "Operação não está aguardando revisão.");
      await tx.auditEvent.create({ data: { organizationId: s.organizationId, actorUserId: s.userId, action: "MIKROTIK_UNCERTAIN_REVIEWED", entityType: "MikrotikJob", entityId: String(b.jobId) } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
