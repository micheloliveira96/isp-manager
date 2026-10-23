import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { access, ApiError, body, fail } from "@/lib/mikrotik-http";
import { auditAccess, clientAction, clientPassword, lockRouter, pendingGuard } from "@/lib/client-access";
import { decrypt, encrypt, fresh } from "@/lib/mikrotik-security";
export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, context: {params: Promise<{id: string}>}) {
 try {
  if(process.env.VERCEL_ENV === "preview") throw new ApiError(403, "Consulte credenciais somente na versão de produção.");
  const s = await access("clients.credentials"), {id} = await context.params;
  const sub = await prisma.mikrotikSubscriber.findFirst({where: {clientId: id, organizationId: s.organizationId, managedLifecycle: true}});
  if(!sub?.credentialCipher) throw new ApiError(404, "Senha não armazenada. Cadastre-a explicitamente após revisar o vínculo.");
  await prisma.$transaction(tx => auditAccess(tx, s, "CLIENT_PPPOE_PASSWORD_VIEWED", id, {routerId: sub.routerId}));
  return NextResponse.json({password: decrypt(sub.credentialCipher).password}, {headers: {"Cache-Control": "no-store"}});
 } catch(e) {return fail(e);}
}
export async function POST(req: NextRequest, context: {params: Promise<{id: string}>}) {
 try {
  const b = await body(req), action = String(b.action), {id} = await context.params;
  const permissions: Record<string, string> = {INSTALL: "clients.install", REVIEW: "clients.credentials", ACTIVATE: "clients.activate", DEACTIVATE: "clients.suspend", GRACE: "clients.grace", CHANGE: "clients.credentials"};
  if(!permissions[action]) throw new ApiError(400, "Ação inválida.");
  const s = await access(permissions[action], req);
  if(action === "INSTALL") {
   if(b.confirm !== true) throw new ApiError(400, "Confirme que a instalação física foi concluída.");
   const reason = String(b.reason || "").trim();
   if(reason.length < 5 || reason.length > 1000) throw new ApiError(400, "Descreva a confirmação manual ou informe a OS correspondente (5 a 1000 caracteres).");
   await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${id} AND "organizationId" = ${s.organizationId} FOR UPDATE`;
    const c = await tx.client.findFirst({where: {id, organizationId: s.organizationId}});
    if(!c) throw new ApiError(404, "Cliente não encontrado nesta empresa.");
    if(c.installationState === "CONFIRMED") return;
    await tx.client.update({where: {id}, data: {installationState: "CONFIRMED", installationConfirmedAt: new Date(), installationConfirmedBy: s.userId, ...(c.status === "WAITING_INSTALLATION" ? {status: "WAITING_ACTIVATION"} : {})}});
    await auditAccess(tx, s, "CLIENT_INSTALLATION_CONFIRMED_MANUALLY", id, {reason});
   });
   return NextResponse.json({ok: true});
  }
  if(action === "REVIEW") {
   if(b.confirm !== true) throw new ApiError(400, "Confirme a revisão do vínculo e o armazenamento da senha, sem alterar o roteador.");
   await prisma.$transaction(async tx => {
    const initial = await tx.mikrotikSubscriber.findFirst({where: {clientId: id, organizationId: s.organizationId}});
    if(!initial) throw new ApiError(404, "Vínculo antigo não encontrado.");
    await lockRouter(tx, initial.routerId, s.organizationId);
    const sub = await tx.mikrotikSubscriber.findUniqueOrThrow({where: {id: initial.id}, include: {router: true}});
    if(sub.managedLifecycle) throw new ApiError(409, "Vínculo já revisado.");
    await pendingGuard(tx, sub);
    if(await tx.mikrotikJob.count({where: {subscriberId: sub.id, status: "PENDING"}})) throw new ApiError(409, "Aguarde a fila antiga.");
    if(!sub.router.enabled || !sub.router.routerOnline || !fresh(sub.router.snapshotAt) || !fresh(sub.router.lastSeenAt)) throw new ApiError(409, "Conecte o roteador para revisar a propriedade do secret.");
    const snapshot = sub.router.snapshot as {users?: {name: string; comment: string; profile: string; disabled: string}[]};
    const user = snapshot.users?.find(u => u.name === sub.username);
    if(!user || user.comment !== "isp-manager:" + sub.id || user.profile !== sub.profile) throw new ApiError(409, "Propriedade/perfil não confirmados. Nenhum acesso antigo foi modificado.");
    await tx.mikrotikSubscriber.update({where: {id: sub.id}, data: {managedLifecycle: true, credentialCipher: encrypt({password: clientPassword(b.pppoePassword)}), accessState: user.disabled === "true" ? "SUSPENDED" : "ACTIVE", syncState: "CONFIRMED"}});
    await auditAccess(tx, s, "CLIENT_LEGACY_LINK_REVIEWED", id, {routerId: sub.routerId, subscriberId: sub.id});
   });
   return NextResponse.json({ok: true});
  }
  const job = await clientAction(s, id, b, req.headers.get("Idempotency-Key") || "");
  return NextResponse.json({job}, {status: 202});
 } catch(e) {return fail(e);}
}
