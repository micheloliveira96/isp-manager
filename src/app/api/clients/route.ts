import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/session";
import { access, ApiError, body, fail } from "@/lib/mikrotik-http";
import { accessPermissions, auditAccess, saveAccess, subscriberPublic } from "@/lib/client-access";
import { clientFields } from "@/lib/client-data";
import { randomUUID } from "node:crypto";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
 try {
  const s = await access("clients.view"), q = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 200);
  const [clients, routers, plans, permissions] = await Promise.all([
   prisma.client.findMany({where: {organizationId: s.organizationId, ...(q ? {OR: [{name: {contains: q, mode: "insensitive"}}, {number: {contains: q, mode: "insensitive"}}, {phone: {contains: q}}, {email: {contains: q, mode: "insensitive"}}, {taxNumber: {contains: q}}]} : {})}, include: {plan: {select: {id: true, name: true, downloadMbps: true, uploadMbps: true}}, invoices: {orderBy: {dueDate: "desc"}, take: 3, select: {id: true, period: true, amount: true, dueDate: true, status: true, paidAt: true}}, mikrotikSubscribers: {select: subscriberPublic}}, orderBy: {name: "asc"}, take: 200}),
   prisma.mikrotikRouter.findMany({where: {organizationId: s.organizationId, enabled: true}, select: {id: true, name: true}, orderBy: {name: "asc"}}),
   prisma.internetPlan.findMany({where: {organizationId: s.organizationId, active: true}, select: {id: true, name: true, downloadMbps: true, uploadMbps: true, monthlyPrice: true}, orderBy: {name: "asc"}}),
   Promise.all(accessPermissions.map(async p => [p, await hasPermission(s, p)] as const)),
  ]);
  return NextResponse.json({clients, routers, plans, permissions: Object.fromEntries(permissions), serverTime: new Date().toISOString()}, {headers: {"Cache-Control": "no-store"}});
 } catch(e) {return fail(e);}
}
export async function POST(request: NextRequest) {
 try {
  const s = await access("clients.manage", request), b = await body(request), withAccess = !!(b.routerId || b.pppoeUsername || b.pppoePassword);
  if(withAccess && !await hasPermission(s, "clients.credentials")) throw new ApiError(403, "Sem permissão para credenciais PPPoE.");
  const client = await prisma.$transaction(async tx => {
   const data = await clientFields(tx, s.organizationId, b), number = String(b.number || "").trim() || "CL-" + randomUUID().slice(0, 12);
   if(number.length > 80) throw new ApiError(400, "Número do cliente muito longo.");
   const c = await tx.client.create({data: {...data, organizationId: s.organizationId, number, status: "WAITING_INSTALLATION", installationState: "PENDING"}});
   if(withAccess) await saveAccess(tx, s, c.id, data.planId, b);
   await auditAccess(tx, s, "CLIENT_CREATED_WAITING_INSTALLATION", c.id);
   return {id: c.id, number: c.number};
  });
  return NextResponse.json({client}, {status: 201});
 } catch(e) {return fail(e);}
}
