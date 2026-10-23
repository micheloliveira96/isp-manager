import { Prisma, MikrotikJob } from "@prisma/client";
import { Command } from "./mikrotik-security";
type Tx = Prisma.TransactionClient;
export async function acknowledgeAccess(tx: Tx, job: MikrotikJob, result: {ok: boolean; code: string}, command: Command) {
  if(job.lifecycleRevision === null || !job.subscriberId) return false;
  const sub = await tx.mikrotikSubscriber.findUniqueOrThrow({where: {id: job.subscriberId}});
  if(sub.revision !== job.lifecycleRevision) {
    await tx.mikrotikJob.update({where: {id: job.id}, data: {status: "CANCELLED", payloadCipher: "", completedAt: new Date()}});
    return true;
  }
  const now = new Date();
  if(result.ok) {
    const grace = job.action === "ACCESS_GRACE";
    const target = job.lifecycleTarget!;
    const deadline = grace ? new Date(now.getTime() + 72 * 3600000) : target === "GRACE" ? sub.graceExpiresAt : null;
    await tx.mikrotikJob.update({where: {id: job.id}, data: {status: "SUCCEEDED", result, payloadCipher: "", completedAt: now}});
    await tx.mikrotikSubscriber.update({where: {id: sub.id}, data: {accessState: target, authStatus: target === "SUSPENDED" ? "SUSPENDED" : "ACTIVE", syncState: "CONFIRMED", syncMessage: "Resultado confirmado no MikroTik.", graceExpiresAt: deadline, ...(grace ? {graceStartedAt: now} : {}), ...(job.action === "ACCESS_CHANGE" ? {planId: command.planId, profile: command.profile} : {})}});
    await tx.client.update({where: {id: sub.clientId}, data: {status: target === "GRACE" ? "GRACE" : target === "SUSPENDED" ? "SUSPENDED" : "ACTIVE", ...(job.action === "ACCESS_CHANGE" ? {planId: command.planId} : {})}});
    await tx.auditEvent.create({data: {organizationId: job.organizationId, actorUserId: job.actorUserId.startsWith("system:") ? null : job.actorUserId, action: "CLIENT_ACCESS_CONFIRMED", entityType: "Client", entityId: sub.clientId, details: {routerId: job.routerId, operation: job.action, revision: sub.revision, graceExpiresAt: deadline?.toISOString() || null, jobId: job.id}}});
  } else {
    const uncertain = result.code === "UNCERTAIN";
    const retry = job.action === "ACCESS_EXPIRE" && !uncertain && !["OWNERSHIP_CONFLICT", "RADIUS_UNSUPPORTED"].includes(result.code);
    const message = result.code === "RADIUS_UNSUPPORTED" ? "RADIUS detectado. Nenhum acesso local foi criado; configure a integração com a fonte RADIUS antes de continuar." : result.code === "OWNERSHIP_CONFLICT" ? "Conflito de propriedade do login. O secret não pertence a este cliente; revise o vínculo." : uncertain ? "Resultado incerto após interrupção do agente. Confira o roteador e revise a operação antes de tentar novamente." : retry ? "Carência vencida: suspensão não confirmada; nova tentativa automática agendada. Pode haver aplicação parcial." : "Operação não confirmada; pode haver aplicação parcial. Confira a conexão/propriedade e tente novamente explicitamente.";
    await tx.mikrotikJob.update({where: {id: job.id}, data: {status: uncertain ? "UNKNOWN" : retry ? "PENDING" : "FAILED", result, attempts: {increment: 1}, retryAt: retry ? new Date(now.getTime() + Math.min(300000, 15000 * 2 ** Math.min(job.attempts, 5))) : null, claimedAt: null, ...(retry ? {} : {completedAt: uncertain ? null : now, payloadCipher: uncertain ? job.payloadCipher : ""})}});
    await tx.mikrotikSubscriber.update({where: {id: sub.id}, data: {syncState: "ERROR", syncMessage: message}});
    await tx.auditEvent.create({data: {organizationId: job.organizationId, actorUserId: job.actorUserId.startsWith("system:") ? null : job.actorUserId, action: "CLIENT_ACCESS_NOT_CONFIRMED", entityType: "Client", entityId: sub.clientId, details: {routerId: job.routerId, operation: job.action, code: result.code, retry, graceExpiresAt: sub.graceExpiresAt?.toISOString() || null, jobId: job.id}}});
  }
  return true;
}
