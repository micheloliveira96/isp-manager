import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/session";
import { access, ApiError, body, fail } from "@/lib/mikrotik-http";
import { auditAccess, saveAccess } from "@/lib/client-access";
import { clientFields } from "@/lib/client-data";
export async function PATCH(req: NextRequest, context: {params: Promise<{id: string}>}) {
 try {
  const s = await access("clients.manage", req), b = await body(req), {id} = await context.params, withAccess = !!(b.routerId || b.pppoeUsername || b.pppoePassword);
  if(withAccess && !await hasPermission(s, "clients.credentials")) throw new ApiError(403, "Sem permissão para credenciais PPPoE.");
  await prisma.$transaction(async tx => {
   const c = await tx.client.findFirst({where: {id, organizationId: s.organizationId}});
   if(!c) throw new ApiError(404, "Cliente não encontrado nesta empresa.");
   const data = await clientFields(tx, s.organizationId, b), subs = await tx.mikrotikSubscriber.count({where: {clientId: id, organizationId: s.organizationId}});
   if(subs && data.planId !== c.planId) throw new ApiError(409, "Altere o plano pela ação explícita de PPPoE para confirmar o resultado no roteador.");
   if(withAccess) await saveAccess(tx, s, id, data.planId, b);
   await tx.client.update({where: {id}, data});
   await auditAccess(tx, s, "CLIENT_UPDATED", id);
  });
  return NextResponse.json({ok: true});
 } catch(e) {return fail(e);}
}
