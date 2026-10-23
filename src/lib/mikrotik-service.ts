import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/session";
import { ApiError } from "./mikrotik-http";
import { ACTIONS, Command, encrypt, fingerprint, fresh, name, password, speed } from "./mikrotik-security";

export async function enqueue(s: SessionUser, input: Record<string, unknown>, requestKey: string) {
  if (!/^[A-Za-z0-9-]{16,100}$/.test(requestKey)) throw new ApiError(400, "Chave de idempotência obrigatória.");
  const action = String(input.action);
  if (!(ACTIONS as readonly string[]).includes(action)) throw new ApiError(400, "Operação não permitida.");
  const fp = fingerprint(input);
  return prisma.$transaction(async tx => {
    const prior = await tx.mikrotikJob.findUnique({ where: { organizationId_requestKey: { organizationId: s.organizationId, requestKey } } });
    if (prior) { if (prior.fingerprint !== fp) throw new ApiError(409, "Chave já usada para outra operação."); return { id: prior.id, status: prior.status }; }
    const router = await tx.mikrotikRouter.findFirst({ where: { id: String(input.routerId || ""), organizationId: s.organizationId, enabled: true } });
    if (!router) throw new ApiError(404, "Roteador não encontrado nesta empresa.");
    await tx.$queryRaw`SELECT id FROM "MikrotikRouter" WHERE id = ${router.id} FOR UPDATE`;
    if (!fresh(router.lastSeenAt) || !router.routerOnline) throw new ApiError(409, "Conecte o agente e confirme o MikroTik online antes de enviar comandos.");
    if (await tx.mikrotikJob.count({ where: { routerId: router.id, status: { in: ["PENDING", "RUNNING"] } } }) >= 20) throw new ApiError(429, "Aguarde as operações pendentes.");
    let subscriberId: string | undefined;
    let command: Command = {};
    try {
      if (action === "PROVISION") {
        const client = await tx.client.findFirst({ where: { id: String(input.clientId || ""), organizationId: s.organizationId } });
        const plan = await tx.internetPlan.findFirst({ where: { id: String(input.planId || ""), organizationId: s.organizationId, active: true } });
        if (!client || !plan) throw new ApiError(404, "Cliente ou plano não encontrado nesta empresa.");
        if (client.installationState !== "LEGACY" || await tx.mikrotikSubscriber.count({where: {clientId: client.id, managedLifecycle: true}})) throw new ApiError(409, "Use a ficha do cliente para confirmar instalação e ativar o acesso.");
        const username = name(input.username), secret = password(input.password);
        const subscriber = await tx.mikrotikSubscriber.create({ data: { organizationId: s.organizationId, routerId: router.id, clientId: client.id, planId: plan.id, username, profile: 'isp-' + plan.id } });
        subscriberId = subscriber.id;
        command = { username, password: secret, profile: subscriber.profile, downMbps: speed(plan.downloadMbps), upMbps: speed(plan.uploadMbps), owner: subscriber.id };
      } else if (action === "SYNC_PLAN") {
        const plan = await tx.internetPlan.findFirst({ where: { id: String(input.planId || ""), organizationId: s.organizationId, active: true } });
        if (!plan) throw new ApiError(404, "Plano não encontrado nesta empresa.");
        command = { profile: 'isp-' + plan.id, downMbps: speed(plan.downloadMbps), upMbps: speed(plan.uploadMbps) };
      } else if (action !== "REFRESH") {
        const subscriber = await tx.mikrotikSubscriber.findFirst({ where: { id: String(input.subscriberId || ""), routerId: router.id, organizationId: s.organizationId } });
        if (!subscriber) throw new ApiError(404, "Vínculo PPPoE não encontrado nesta empresa.");
        if (subscriber.managedLifecycle) throw new ApiError(409, "Este acesso é gerenciado pela ficha do cliente. Use as ações na página Clientes.");
        if (await tx.mikrotikJob.count({ where: { subscriberId: subscriber.id, status: { in: ["PENDING", "RUNNING", "UNKNOWN"] } } })) throw new ApiError(409, "Existe uma operação pendente ou incerta para este usuário; confira o estado antes de continuar.");
        subscriberId = subscriber.id;
        command = { username: subscriber.username, owner: subscriber.id };
        if (action === "PASSWORD") command.password = password(input.password);
        if (action === "PLAN") {
          const plan = await tx.internetPlan.findFirst({ where: { id: String(input.planId || ""), organizationId: s.organizationId, active: true } });
          if (!plan) throw new ApiError(404, "Plano não encontrado nesta empresa.");
          command = { ...command, profile: 'isp-' + plan.id, downMbps: speed(plan.downloadMbps), upMbps: speed(plan.uploadMbps), planId: plan.id };
        }
      }
    } catch (e) { if (e instanceof ApiError || e instanceof Prisma.PrismaClientKnownRequestError) throw e; throw new ApiError(400, e instanceof Error ? e.message : "Dados inválidos."); }
    const job = await tx.mikrotikJob.create({ data: { organizationId: s.organizationId, routerId: router.id, subscriberId, action, requestKey, fingerprint: fp, payloadCipher: encrypt(command), expiresAt: new Date(Date.now() + 5 * 60000), actorUserId: s.userId } });
    await tx.auditEvent.create({ data: { organizationId: s.organizationId, actorUserId: s.userId, action: 'MIKROTIK_QUEUED', entityType: 'MikrotikJob', entityId: job.id, details: { operation: action, routerId: router.id, subscriberId: subscriberId || null } } });
    return { id: job.id, status: job.status };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
