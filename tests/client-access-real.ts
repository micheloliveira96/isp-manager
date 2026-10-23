// HTTP application + isolated Postgres + actual agent operations + lab CHR.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import fs from "node:fs";
import {PrismaClient} from "@prisma/client";
import {createSession} from "../src/lib/session";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {execute, collect} = require("../agent/operations");
const db = new PrismaClient(), base = "http://127.0.0.1:3099", stamp = Date.now(), login = "isp-life-" + stamp, secret = randomUUID();
const env = Object.fromEntries(fs.readFileSync("../mikrotik-gateway/.env", "utf8").split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => {const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1)];}));
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
let gatewayQueue = Promise.resolve();
let agentToken = "", routerId = "", orgId = "", foreignId = "", cookie = "", otherCookie = "", attendantCookie = "", original: Record<string, string> | null = null;
const evidence: {at: string; check: string}[] = [], profileIds: string[] = [];
async function gw(method: string, path: string, body?: unknown) {
 const prior = gatewayQueue; let release!: () => void;
 gatewayQueue = new Promise<void>(r => {release = r;});
 await prior; await delay(800); // Serial pacing, including parallel snapshot reads.
 try {
 const r = await fetch("http://127.0.0.1:8088" + path, {method, headers: {Authorization: "Bearer " + env.GATEWAY_TOKEN, "Content-Type": "application/json"}, ...(body ? {body: JSON.stringify(body)} : {})});
 if(!r.ok) throw Object.assign(Error("Gateway HTTP " + r.status), {status: r.status});
 return await r.json();
 } finally {release();}
}
async function api(path: string, method = "GET", body?: unknown, auth = cookie, key = randomUUID()) {
 const r = await fetch(base + path, {method, headers: {Cookie: auth, "Content-Type": "application/json", "Idempotency-Key": key}, ...(body ? {body: JSON.stringify(body)} : {})});
 return {status: r.status, data: await r.json()};
}
async function poll(snapshot?: unknown) {
 const r = await fetch(base + "/api/mikrotik/agent", {method: "POST", headers: {Authorization: "Bearer " + agentToken, "Content-Type": "application/json"}, body: JSON.stringify({type: "poll", protocolVersion: 2, ...(snapshot ? {snapshot} : {})})});
 const data = await r.json(); assert.equal(r.status, 200, JSON.stringify(data)); return data.job;
}
async function ack(job: {id: string; lease: string}, result = {ok: true, code: "CONFIRMED"}) {
 const r = await fetch(base + "/api/mikrotik/agent", {method: "POST", headers: {Authorization: "Bearer " + agentToken, "Content-Type": "application/json"}, body: JSON.stringify({type: "ack", jobId: job.id, lease: job.lease, result})});
 assert.equal(r.status, 200, await r.text());
}
async function perform(jobId?: string) {
 const job = await poll(await collect(gw)); assert.ok(job, "Comando deve ser entregue"); if(jobId) assert.equal(job.id, jobId);
 const guarded = async (method: string, path: string, body?: unknown) => {
  if(method !== "GET") {const r = await fetch(base + "/api/mikrotik/agent", {method: "POST", headers: {Authorization: "Bearer " + agentToken, "Content-Type": "application/json"}, body: JSON.stringify({type: "authorize", jobId: job.id, lease: job.lease})}); assert.equal(r.status, 200);}
  return gw(method, path, body);
 };
 await execute(job, guarded); await ack(job); await ack(job); return job;
}
const mark = (check: string) => {evidence.push({at: new Date().toISOString(), check}); console.log("OK", check);};
async function main() {
 assert.match(process.env.DATABASE_URL || "", /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/isp_test\?schema=integration$/);
 const org = await db.organization.create({data: {name: "Laboratório ciclo clientes", slug: "life-" + stamp}}); orgId = org.id;
 foreignId = (await db.organization.create({data: {name: "Outra empresa teste", slug: "life-other-" + stamp}})).id;
 async function user(organizationId: string, role: string) {const u = await db.user.create({data: {organizationId, name: "Teste " + role, email: role + "@example.invalid", passwordHash: "test-only-no-login", role}}); return "isp_session=" + await createSession({userId: u.id, organizationId, role, name: u.name, email: u.email});}
 cookie = await user(orgId, "MANAGER"); otherCookie = await user(foreignId, "MANAGER"); attendantCookie = await user(orgId, "ATTENDANT");
 const plan = await db.internetPlan.create({data: {organizationId: orgId, name: "Plano teste ciclo", downloadMbps: 200, uploadMbps: 100, monthlyPrice: 0}}); profileIds.push("isp-" + plan.id);
 const registered = await api("/api/mikrotik", "POST", {name: "CHR ciclo isolado"}); assert.equal(registered.status, 201); routerId = registered.data.router.id; agentToken = registered.data.agentToken;
 await poll(await collect(gw));
 assert.equal((await gw("GET", "/api/pppoe/auth-source")).source, "LOCAL");
 const input = {name: "Teste cadastro sem liberação", phone: "000000000", planId: plan.id, monthlyPrice: 0, routerId, pppoeUsername: login, pppoePassword: secret};
 const created = await api("/api/clients", "POST", input); assert.equal(created.status, 201, JSON.stringify(created.data)); const clientId = created.data.client.id;
 const sub = await db.mikrotikSubscriber.findFirstOrThrow({where: {clientId}});
 assert.ok(sub.credentialCipher && !sub.credentialCipher.includes(secret)); assert.equal((await db.client.findUniqueOrThrow({where: {id: clientId}})).installationState, "PENDING");
 await assert.rejects(gw("GET", "/api/pppoe/users/" + login), {status: 404});
 const action = (id: string, action: string, extra: Record<string, unknown> = {}, auth = cookie, key = randomUUID()) => api(`/api/clients/${id}/access`, "POST", {action, ...extra}, auth, key);
 assert.equal((await action(clientId, "ACTIVATE")).status, 409);
 assert.equal((await api("/api/mikrotik/jobs", "POST", {action: "PROVISION", routerId, clientId, planId: plan.id, username: login, password: secret})).status, 409);
 assert.equal((await api("/api/clients", "POST", {...input, name: "Duplicado"})).status, 409);
 mark("Cadastro cifra senha, não cria secret e impede ativação antes da instalação e desvio pelo painel antigo");
 assert.equal((await action(clientId, "INSTALL", {confirm: true, reason: "Instalação física confirmada no laboratório"})).status, 200);
 const key = randomUUID(), [activation, duplicate] = await Promise.all([action(clientId, "ACTIVATE", {}, cookie, key), action(clientId, "ACTIVATE", {}, cookie, key)]); assert.equal(activation.status, 202);
 assert.equal(duplicate.data.job.id, activation.data.job.id);
 assert.equal((await action(clientId, "ACTIVATE")).status, 409);
 await perform(activation.data.job.id);
 assert.equal((await gw("GET", "/api/pppoe/users/" + login)).disabled, "false");
 assert.equal((await db.mikrotikSubscriber.findUniqueOrThrow({where: {id: sub.id}})).accessState, "ACTIVE");
 const list = await api("/api/clients"); assert.ok(!JSON.stringify(list.data).includes(secret)); assert.ok(!JSON.stringify(list.data).includes("credentialCipher"));
 assert.equal((await api(`/api/clients/${clientId}/access`, "GET", undefined, attendantCookie)).status, 403);
 assert.equal((await action(clientId, "DEACTIVATE", {confirm: true}, attendantCookie)).status, 403);
 assert.equal((await action(clientId, "GRACE", {confirm: true}, attendantCookie)).status, 403);
 assert.equal((await action(clientId, "INSTALL", {confirm: true, reason: "testar"}, attendantCookie)).status, 403);
 assert.equal((await action(clientId, "ACTIVATE", {}, otherCookie)).status, 409);
 assert.equal((await api("/api/clients", "POST", input, otherCookie)).status, 400);
 mark("Ativação real confirmada, idempotência, cliques concorrentes, permissões e isolamento entre empresas");
 // The existing testeips account is explicitly a lab client, with a real active client-lab session.
 // Mirror its owner in the isolated DB to test cutting an actual session without touching production data.
 original = await gw("GET", "/api/pppoe/users/testeips");
 assert.equal(original!.comment, "isp-manager:cmvk7csnd0003js08pkkjo45u");
 assert.equal(original!.disabled, "false"); assert.ok(original!.session, "cliente-lab deve estar conectado como testeips");
 const saved = JSON.parse(fs.readFileSync("../backups/pppoe-teste.json", "utf8")); assert.equal(saved.username, "testeips");
 const lab = await db.client.create({data: {organizationId: orgId, number: "LAB-REAL", name: "cliente-lab (espelho isolado)", phone: "000", monthlyPrice: 0, planId: plan.id}});
 const owner = original!.comment.slice("isp-manager:".length);
 await db.mikrotikSubscriber.create({data: {id: owner, organizationId: orgId, clientId: lab.id, routerId, planId: plan.id, username: "testeips", profile: original!.profile}});
 await poll(await collect(gw));
 assert.equal((await action(lab.id, "REVIEW", {confirm: true, pppoePassword: saved.password})).status, 200);
 assert.equal((await action(lab.id, "INSTALL", {confirm: true, reason: "VM cliente-lab já instalada; revisão de laboratório"})).status, 200);
 let queued = await action(lab.id, "DEACTIVATE", {confirm: true}); assert.equal(queued.status, 202); await perform(queued.data.job.id);
 let actual = await gw("GET", "/api/pppoe/users/testeips"); assert.equal(actual.disabled, "true"); assert.equal(actual.session, null);
 mark("Revisão explícita de legado; suspensão desabilita secret e derruba sessão PPPoE real do cliente-lab");
 queued = await action(lab.id, "GRACE", {confirm: true}); assert.equal(queued.status, 202); await perform(queued.data.job.id);
 let state = await db.mikrotikSubscriber.findUniqueOrThrow({where: {id: owner}}); assert.equal(state.accessState, "GRACE"); assert.equal(state.graceExpiresAt!.getTime() - state.graceStartedAt!.getTime(), 72 * 3600000);
 assert.equal((await action(lab.id, "GRACE", {confirm: true})).status, 409);
 await delay(11000); actual = await gw("GET", "/api/pppoe/users/testeips"); assert.ok(actual.session);
 // Test acceleration changes only a deadline in the isolated database, never the production policy.
 await db.mikrotikSubscriber.update({where: {id: owner}, data: {graceExpiresAt: new Date(Date.now() - 1000)}});
 const offline = await poll({online: false}); assert.equal(offline, null);
 state = await db.mikrotikSubscriber.findUniqueOrThrow({where: {id: owner}}); assert.equal(state.accessState, "GRACE");
 const expiry = await db.mikrotikJob.findFirstOrThrow({where: {subscriberId: owner, action: "ACCESS_EXPIRE", status: "PENDING"}});
 const failed = await poll(await collect(gw)); assert.equal(failed.id, expiry.id);
 await ack(failed, {ok: false, code: "NOT_CONFIRMED"}); await ack(failed, {ok: false, code: "NOT_CONFIRMED"});
 const job = await db.mikrotikJob.findUniqueOrThrow({where: {id: expiry.id}}); assert.equal(job.status, "PENDING"); assert.equal(job.attempts, 1); assert.ok(job.retryAt);
 await db.mikrotikJob.update({where: {id: job.id}, data: {retryAt: new Date(Date.now() - 1)}});
 await perform(expiry.id);
 actual = await gw("GET", "/api/pppoe/users/testeips"); assert.equal(actual.disabled, "true"); assert.equal(actual.session, null);
 assert.equal((await db.mikrotikSubscriber.findUniqueOrThrow({where: {id: owner}})).accessState, "SUSPENDED");
 mark("Carência de 72h desde confirmação, sem extensão por repetição; expiração persistente, offline e retry idempotente com corte real");
 queued = await action(lab.id, "GRACE", {confirm: true}); await perform(queued.data.job.id);
 await db.mikrotikSubscriber.update({where: {id: owner}, data: {graceExpiresAt: new Date(Date.now() - 1000)}});
 await poll({online: false}); const stale = await db.mikrotikJob.findFirstOrThrow({where: {subscriberId: owner, action: "ACCESS_EXPIRE", status: "PENDING"}});
 queued = await action(lab.id, "ACTIVATE"); assert.equal(queued.status, 202);
 assert.equal((await db.mikrotikJob.findUniqueOrThrow({where: {id: stale.id}})).status, "CANCELLED");
 await perform(queued.data.job.id); await poll(await collect(gw));
 state = await db.mikrotikSubscriber.findUniqueOrThrow({where: {id: owner}}); assert.equal(state.accessState, "ACTIVE"); assert.equal(state.graceExpiresAt, null);
 actual = await gw("GET", "/api/pppoe/users/testeips"); assert.equal(actual.disabled, "false");
 mark("Ativação definitiva cancela carência e tarefa antiga; polling posterior não suspende o cliente reativado");
 // Unknown results block all later commands until explicit operator review.
 queued = await action(lab.id, "DEACTIVATE", {confirm: true}); const uncertain = await poll(await collect(gw)); assert.equal(uncertain.id, queued.data.job.id);
 await ack(uncertain, {ok: false, code: "UNCERTAIN"}); assert.equal((await action(lab.id, "ACTIVATE")).status, 409);
 assert.equal((await api("/api/mikrotik/jobs", "PATCH", {jobId: uncertain.id, confirmReviewed: true})).status, 200);
 queued = await action(lab.id, "ACTIVATE"); assert.equal(queued.status, 202); await perform(queued.data.job.id);
 mark("Interrupção com resultado incerto preserva último estado e exige revisão antes de liberar nova operação");
 fs.writeFileSync("../backups/client-access-real-result.json", JSON.stringify({at: new Date().toISOString(), isolatedDatabase: true, evidence}, null, 2));
}
main().catch(e => {console.error(e.stack); process.exitCode = 1;}).finally(async () => {
 try {
  if(original) {
   await gw("PUT", "/api/pppoe/users/testeips/profile", {owner: original.comment.slice("isp-manager:".length), profile: original.profile, reconnect: true});
   await gw("POST", "/api/pppoe/users/testeips/reactivate", {owner: original.comment.slice("isp-manager:".length)});
  }
  // Direct REST cleanup only of the unique secret/profile created by this test.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {createClient} = require("../../mikrotik-gateway/routeros");
  const rt = createClient({url: env.MIKROTIK_URL, user: env.MIKROTIK_USER, password: env.MIKROTIK_PASSWORD, caPath: "../mikrotik-gateway/certs/lab-ca.crt"});
  const user = (await rt.get("/ppp/secret?name=" + login))[0]; if(user?.comment?.startsWith("isp-manager:")) await rt.del("/ppp/secret/" + encodeURIComponent(user[".id"]));
  for(const profile of profileIds) {const p = (await rt.get("/ppp/profile?name=" + profile))[0]; if(p) await rt.del("/ppp/profile/" + encodeURIComponent(p[".id"]));}
  for(const id of [orgId, foreignId].filter(Boolean)) {
   await db.mikrotikJob.deleteMany({where: {organizationId: id}}); await db.mikrotikSubscriber.deleteMany({where: {organizationId: id}}); await db.mikrotikRouter.deleteMany({where: {organizationId: id}}); await db.auditEvent.deleteMany({where: {organizationId: id}}); await db.user.deleteMany({where: {organizationId: id}}); await db.organization.delete({where: {id}});
  }
 } finally {await db.$disconnect();}
});
