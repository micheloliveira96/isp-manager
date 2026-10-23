import { Prisma, MikrotikSubscriber } from "@prisma/client";
import { prisma } from "./prisma";
import { SessionUser } from "./session";
import { ApiError } from "./mikrotik-http";
import { decrypt, encrypt, fingerprint, password as rawPassword, name as rawName, speed as rawSpeed } from "./mikrotik-security";
function validate<T>(read: () => T): T {try {return read();} catch(e) {throw new ApiError(400, e instanceof Error ? e.message : "Dados inválidos.");}}
const name = (v: unknown) => validate(() => rawName(v));
export const clientPassword = (v: unknown) => validate(() => rawPassword(v));
const password = clientPassword;
const speed = (v: number) => validate(() => rawSpeed(v));

export const accessPermissions = ["clients.view", "clients.manage", "clients.credentials", "clients.install", "clients.activate", "clients.suspend", "clients.grace"];
export const subscriberPublic = {
  id: true, routerId: true, clientId: true, planId: true, username: true, profile: true,
  managedLifecycle: true, accessState: true, syncState: true, syncMessage: true, revision: true,
  graceStartedAt: true, graceExpiresAt: true,
  jobs: {where: {status: {in: ["PENDING", "RUNNING", "UNKNOWN"]}}, orderBy: {createdAt: "desc"}, take: 1, select: {action: true, status: true}},
  router: { select: { id: true, name: true, enabled: true, routerOnline: true, lastSeenAt: true, snapshotAt: true, snapshot: true } },
  plan: { select: { id: true, name: true, downloadMbps: true, uploadMbps: true } },
} satisfies Prisma.MikrotikSubscriberSelect;
type Tx = Prisma.TransactionClient;
export async function lockRouter(tx: Tx, id: string, organizationId: string) {
  const rows = await tx.$queryRaw<{id: string}[]>`SELECT id FROM "MikrotikRouter" WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`;
  if (!rows.length) throw new ApiError(404, "Roteador não encontrado nesta empresa.");
}
export async function auditAccess(tx: Tx, s: SessionUser, action: string, clientId: string, details: Prisma.InputJsonObject = {}) {
  await tx.auditEvent.create({ data: { organizationId: s.organizationId, actorUserId: s.userId, action, entityType: "Client", entityId: clientId, details } });
}
export async function pendingGuard(tx: Tx, sub: MikrotikSubscriber) {
  if (await tx.mikrotikJob.count({ where: { subscriberId: sub.id, status: { in: ["RUNNING", "UNKNOWN"] } } }))
    throw new ApiError(409, "Há comando em execução ou resultado incerto. Confira o agente e revise a operação no painel MikroTik antes de continuar.");
}
export async function saveAccess(tx: Tx, s: SessionUser, clientId: string, planId: string | null, b: Record<string, unknown>) {
  const routerId = String(b.routerId || "");
  const username = name(b.pppoeUsername);
  if (!routerId || !planId) throw new ApiError(400, "Selecione o roteador e o plano do PPPoE.");
  await lockRouter(tx, routerId, s.organizationId);
  const router = await tx.mikrotikRouter.findFirst({ where: { id: routerId, organizationId: s.organizationId, enabled: true } });
  const plan = await tx.internetPlan.findFirst({ where: { id: planId, organizationId: s.organizationId, active: true } });
  if (!router || !plan) throw new ApiError(400, "Roteador ou plano inválido nesta empresa.");
  if(await tx.mikrotikSubscriber.count({where: {routerId, username, clientId: {not: clientId}}})) throw new ApiError(409, "Login PPPoE já cadastrado neste roteador para outro cliente.");
  speed(plan.downloadMbps); speed(plan.uploadMbps);
  const existing = await tx.mikrotikSubscriber.findMany({ where: { organizationId: s.organizationId, clientId } });
  if (existing.length > 1) throw new ApiError(409, "Existem vários vínculos. Revise a integração antes de editar este cliente.");
  const sub = existing[0];
  if (sub) {
    if (!sub.managedLifecycle) throw new ApiError(409, "Vínculo antigo: use a revisão explícita antes de gerenciar o acesso pela ficha.");
    await pendingGuard(tx, sub);
    if (await tx.mikrotikJob.count({where: {subscriberId: sub.id, status: "PENDING"}})) throw new ApiError(409, "Aguarde ou conclua a operação pendente antes de editar credenciais.");
    if (sub.routerId !== routerId || sub.username !== username) throw new ApiError(409, "Roteador e login não podem ser trocados após o vínculo. Uma transferência exige revisão para não deixar acesso antigo liberado.");
    if (sub.planId !== planId || b.pppoePassword) {
      if (sub.accessState !== "WAITING") throw new ApiError(409, "Desative e use a alteração explícita de plano/senha na ficha. Salvar cadastro não altera credenciais provisionadas.");
      await tx.mikrotikSubscriber.update({ where: { id: sub.id }, data: {planId, profile: "isp-" + planId, ...(b.pppoePassword ? {credentialCipher: encrypt({password: password(b.pppoePassword)})} : {})} });
    }
  } else {
    const secret = password(b.pppoePassword);
    const snapshot = router.snapshot as {users?: {name: string}[]} | null;
    if (snapshot?.users?.some(u => u.name === username)) throw new ApiError(409, "Este login já existe no roteador. O vínculo precisa ser revisado, sem assumir propriedade pelo nome.");
    await tx.mikrotikSubscriber.create({ data: { organizationId: s.organizationId, clientId, routerId, planId, username, profile: "isp-" + planId, managedLifecycle: true, credentialCipher: encrypt({ password: secret }) } });
  }
  await auditAccess(tx, s, "CLIENT_PPPOE_SAVED", clientId, {routerId, username, planId});
}
const commandFor = (sub: MikrotikSubscriber, plan: {id: string; downloadMbps: number; uploadMbps: number}) => ({username: sub.username, owner: sub.id, profile: "isp-" + plan.id, planId: plan.id, downMbps: speed(plan.downloadMbps), upMbps: speed(plan.uploadMbps)});

export async function clientAction(s: SessionUser, clientId: string, b: Record<string, unknown>, requestKey: string) {
  if (!/^[A-Za-z0-9-]{16,100}$/.test(requestKey)) throw new ApiError(400, "Chave de idempotência obrigatória.");
  const action = String(b.action);
  const fp = fingerprint({...b, clientId});
  return prisma.$transaction(async tx => {
    if(await tx.mikrotikSubscriber.count({where: {clientId, organizationId: s.organizationId}}) > 1) throw new ApiError(409, "Cliente com vários vínculos PPPoE. Revise os roteadores antes de gerenciar o acesso pela ficha.");
    const initial = await tx.mikrotikSubscriber.findFirst({where: {clientId, organizationId: s.organizationId}});
    if (!initial) throw new ApiError(409, "Cadastre o vínculo PPPoE na edição do cliente primeiro.");
    await lockRouter(tx, initial.routerId, s.organizationId);
    const prior = await tx.mikrotikJob.findUnique({where: {organizationId_requestKey: {organizationId: s.organizationId, requestKey}}});
    if (prior) { if(prior.fingerprint !== fp) throw new ApiError(409, "Chave já usada para outra operação."); return {id: prior.id, status: prior.status}; }
    const sub = await tx.mikrotikSubscriber.findUniqueOrThrow({where: {id: initial.id}, include: {client: true, plan: true, router: true}});
    if (!sub.managedLifecycle) throw new ApiError(409, "Revise explicitamente o vínculo antigo antes de ativar o novo fluxo.");
    if (sub.client.installationState !== "CONFIRMED" && action !== "DEACTIVATE") throw new ApiError(409, "A instalação ainda não foi confirmada. Concluir cadastro ou OS não libera acesso.");
    if (!sub.router.enabled) throw new ApiError(409, "Agente desativado. Reative a comunicação antes de solicitar comandos.");
    await pendingGuard(tx, sub);
    const pending = await tx.mikrotikJob.findMany({where: {subscriberId: sub.id, status: "PENDING"}});
    if (pending.some(j => j.action !== "ACCESS_EXPIRE")) throw new ApiError(409, "Já existe uma solicitação pendente. Não é necessário clicar novamente.");
    let target: string, operation: string;
    let payload = commandFor(sub, sub.plan);
    if (action === "ACTIVATE") { target = "ACTIVE"; operation = "ACCESS_ACTIVATE"; if(!sub.credentialCipher) throw new ApiError(409, "Salve uma senha PPPoE antes de ativar."); payload = {...payload, ...decrypt(sub.credentialCipher)}; }
    else if (action === "DEACTIVATE") { if(b.confirm !== true) throw new ApiError(400, "Confirme a interrupção do acesso."); target = "SUSPENDED"; operation = "ACCESS_SUSPEND"; }
    else if (action === "GRACE") {
      if(b.confirm !== true) throw new ApiError(400, "Confirme uma nova concessão de 72 horas.");
      if(sub.accessState !== "SUSPENDED" || sub.syncState !== "CONFIRMED") throw new ApiError(409, "Carência exige cliente instalado e suspensão confirmada. Cliques repetidos não estendem o prazo.");
      target = "GRACE"; operation = "ACCESS_GRACE";
      if(!sub.credentialCipher) throw new ApiError(409, "Cadastre a senha PPPoE antes de conceder carência.");
      payload = {...payload, ...decrypt(sub.credentialCipher)};
    } else if (action === "CHANGE") {
      if(sub.accessState === "WAITING") throw new ApiError(409, "Edite as credenciais do cadastro antes da primeira ativação.");
      if(b.confirm !== true) throw new ApiError(400, "Confirme a alteração explícita das credenciais/plano e a reconexão.");
      if (!b.pppoePassword && !b.planId) throw new ApiError(400, "Informe senha ou plano para alterar.");
      const plan = await tx.internetPlan.findFirst({where: {id: String(b.planId || sub.planId), organizationId: s.organizationId, active: true}});
      if(!plan) throw new ApiError(400, "Plano inválido nesta empresa.");
      const cipher = b.pppoePassword ? encrypt({password: password(b.pppoePassword)}) : sub.credentialCipher;
      if(!cipher) throw new ApiError(409, "Cadastre a senha PPPoE.");
      // Desired credentials persist encrypted; the confirmed plan changes only on ack.
      payload = {...commandFor(sub, plan), ...decrypt(cipher)};
      target = sub.accessState; operation = "ACCESS_CHANGE";
      await tx.mikrotikSubscriber.update({where: {id: sub.id}, data: {credentialCipher: cipher}});
    } else throw new ApiError(400, "Ação inválida.");
    if (["ACTIVATE", "GRACE"].includes(action) && !sub.plan.active) throw new ApiError(409, "Plano inativo. Revise o plano antes de liberar acesso.");
    const revision = sub.revision + 1;
    await tx.mikrotikJob.updateMany({where: {subscriberId: sub.id, status: "PENDING", action: "ACCESS_EXPIRE"}, data: {status: "CANCELLED", completedAt: new Date(), payloadCipher: ""}});
    const job = await tx.mikrotikJob.create({data: {organizationId: s.organizationId, routerId: sub.routerId, subscriberId: sub.id, action: operation, lifecycleRevision: revision, lifecycleTarget: target, requestKey, fingerprint: fp, payloadCipher: encrypt(payload), expiresAt: new Date("2099-01-01T00:00:00Z"), actorUserId: s.userId}});
    await tx.mikrotikSubscriber.update({where: {id: sub.id}, data: {revision, syncState: "PENDING", syncMessage: "Solicitação pendente de confirmação no MikroTik."}});
    await auditAccess(tx, s, "CLIENT_ACCESS_QUEUED", clientId, {routerId: sub.routerId, operation, jobId: job.id, revision, graceExpiresAt: sub.graceExpiresAt?.toISOString() || null});
    return {id: job.id, status: job.status};
  }, {timeout: 15000});
}

// Called on every authenticated agent poll. Deadlines survive browser/agent/server restarts.
// Router row must be locked by caller. This also serializes expiry with manual activation.
export async function scheduleGrace(tx: Tx, routerId: string, organizationId: string, now = new Date()) {
  const due = await tx.mikrotikSubscriber.findMany({where: {routerId, organizationId, managedLifecycle: true, accessState: "GRACE", graceExpiresAt: {lte: now}}, include: {plan: true}, take: 100});
  for (const sub of due) {
    if(await tx.mikrotikJob.count({where: {subscriberId: sub.id, status: {in: ["PENDING", "RUNNING", "UNKNOWN"]}}})) continue;
    const requestKey = `expiry-${sub.id}-${sub.revision}`;
    if(await tx.mikrotikJob.count({where: {organizationId, requestKey}})) continue;
    await tx.mikrotikJob.create({data: {organizationId, routerId, subscriberId: sub.id, action: "ACCESS_EXPIRE", lifecycleRevision: sub.revision, lifecycleTarget: "SUSPENDED", requestKey, fingerprint: fingerprint({requestKey}), payloadCipher: encrypt(commandFor(sub, sub.plan)), expiresAt: new Date("2099-01-01T00:00:00Z"), actorUserId: "system:grace"}});
    await tx.mikrotikSubscriber.update({where: {id: sub.id}, data: {syncState: "PENDING", syncMessage: "Carência vencida. Suspensão pendente; depende da comunicação com o roteador."}});
    await tx.auditEvent.create({data: {organizationId, action: "CLIENT_GRACE_EXPIRED", entityType: "Client", entityId: sub.clientId, details: {routerId, graceExpiresAt: sub.graceExpiresAt!.toISOString(), revision: sub.revision}}});
  }
}
