// Integração real: banco exclusivo de testes + HTTP do ISP Manager + agente + gateway + CHR.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { createSession } from "../src/lib/session";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('../../mikrotik-gateway/routeros');
const prisma = new PrismaClient();
const env = Object.fromEntries(fs.readFileSync('../mikrotik-gateway/.env', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
const rt = createClient({ url: env.MIKROTIK_URL, user: env.MIKROTIK_USER, password: env.MIKROTIK_PASSWORD, caPath: '../mikrotik-gateway/certs/lab-ca.crt' });
const endpoint = 'http://127.0.0.1:3099';
const stamp = Date.now(), username = 'isp-it-' + stamp;
const outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'isp-agent-it-'));
let orgId = '', foreignId = '', profile = '', agentToken = '';
async function main() {
  assert.ok(process.env.DATABASE_URL?.includes('127.0.0.1:55437/isp_test?schema=integration'), 'Use somente banco isolado');
  for (let attempt = 0; attempt < 8; attempt++) {
    const ready = await fetch('http://127.0.0.1:8088/api/router/identity', { headers: { Authorization: 'Bearer ' + env.GATEWAY_TOKEN } });
    if (ready.ok) break;
    if (ready.status !== 429 || attempt === 7) throw new Error('Gateway não disponível para o teste: HTTP ' + ready.status);
    console.log('Aguardando janela real de rate limit do gateway...');
    await new Promise(r => setTimeout(r, 10000));
  }
  const org = await prisma.organization.create({ data: { name: 'Teste isolado MikroTik', slug: 'it-' + stamp } }); orgId = org.id;
  const foreign = await prisma.organization.create({ data: { name: 'Teste isolamento', slug: 'other-' + stamp } }); foreignId = foreign.id;
  const user = await prisma.user.create({ data: { organizationId: orgId, name: 'Teste integração', email: 'integration@example.invalid', passwordHash: 'no-login', role: 'MANAGER' } });
  const foreignUser = await prisma.user.create({ data: { organizationId: foreignId, name: 'Outra empresa', email: 'integration@example.invalid', passwordHash: 'no-login', role: 'MANAGER' } });
  const cookie = 'isp_session=' + await createSession({ userId: user.id, organizationId: orgId, role: 'MANAGER', name: user.name, email: user.email });
  const foreignCookie = 'isp_session=' + await createSession({ userId: foreignUser.id, organizationId: foreignId, role: 'MANAGER', name: foreignUser.name, email: foreignUser.email });
  async function api(p: string, method = 'GET', data?: unknown, opts: { key?: string; cookie?: string } = {}) {
    const res = await fetch(endpoint + p, { method, headers: { Cookie: opts.cookie || cookie, 'Content-Type': 'application/json', 'Idempotency-Key': opts.key || randomUUID() }, body: data ? JSON.stringify(data) : undefined });
    return { status: res.status, data: await res.json() };
  }
  const client = await prisma.client.create({ data: { organizationId: orgId, name: 'Cliente de teste isolado', number: 'IT1', phone: '000000000', monthlyPrice: 0 } });
  const plan = await prisma.internetPlan.create({ data: { organizationId: orgId, name: 'Plano de teste isolado', downloadMbps: 200, uploadMbps: 100, monthlyPrice: 0 } }); profile = 'isp-' + plan.id;
  const created = await api('/api/mikrotik', 'POST', { name: 'CHR teste integração' }); assert.equal(created.status, 201); agentToken = created.data.agentToken; const routerId = created.data.router.id;
  function agentOnce() {
    const run = spawnSync(process.execPath, ['agent/agent.js'], { env: { ...process.env, ISP_URL: endpoint, ISP_AGENT_TOKEN: agentToken, GATEWAY_URL: 'http://127.0.0.1:8088', GATEWAY_TOKEN: env.GATEWAY_TOKEN, AGENT_TEST: '1', AGENT_ONCE: '1', AGENT_DATA_DIR: outbox }, encoding: 'utf8', timeout: 60000 });
    assert.equal(run.status, 0, run.stderr); assert.ok(!run.stderr, run.stderr);
  }
  async function finish(jobId: string) {
    for (let i = 0; i < 12; i++) {
      agentOnce();
      const current = await prisma.mikrotikJob.findUniqueOrThrow({ where: { id: jobId } });
      if (current.status === 'SUCCEEDED') return;
      assert.ok(['PENDING', 'RUNNING'].includes(current.status), 'Resultado: ' + current.status);
      await new Promise(r => setTimeout(r, 6000));
    }
    throw new Error('A operação não confirmou após aguardar o limite de consultas do gateway');
  }
  agentOnce();
  const online = await api('/api/mikrotik'); assert.equal(online.data.routers[0].online, true); assert.equal(online.data.routers[0].snapshot.identity.name, 'chr-lab');
  console.log('OK API → agente → gateway → CHR real; identidade e sessões reais');
  assert.equal((await api('/api/mikrotik', 'GET', undefined, { cookie: foreignCookie })).data.routers.length, 0);
  const input = { action: 'PROVISION', routerId, clientId: client.id, planId: plan.id, username, password: randomUUID() };
  assert.equal((await api('/api/mikrotik/jobs', 'POST', input, { cookie: foreignCookie })).status, 404);
  const requestKey = randomUUID(); const queued = await api('/api/mikrotik/jobs', 'POST', input, { key: requestKey }); assert.equal(queued.status, 202);
  const repeat = await api('/api/mikrotik/jobs', 'POST', input, { key: requestKey }); assert.equal(repeat.data.job.id, queued.data.job.id);
  assert.equal((await api('/api/mikrotik/jobs', 'POST', { ...input, password: 'changed-password' }, { key: requestKey })).status, 409);
  assert.ok(!(await prisma.mikrotikJob.findUniqueOrThrow({ where: { id: queued.data.job.id } })).payloadCipher.includes(input.password));
  await finish(queued.data.job.id);
  const job = await prisma.mikrotikJob.findUniqueOrThrow({ where: { id: queued.data.job.id } }); assert.equal(job.status, 'SUCCEEDED'); assert.equal(job.payloadCipher, '');
  const real = (await rt.get('/ppp/secret?name=' + username))[0]; assert.equal(real.profile, profile); assert.ok(real.comment.startsWith('isp-manager:'));
  assert.equal((await rt.get('/ppp/profile?name=' + profile))[0]['rate-limit'], '100M/200M');
  console.log('OK criação real PPPoE e perfil; isolamento entre empresas; idempotência; senha cifrada e descartada');
  const sub = await prisma.mikrotikSubscriber.findFirstOrThrow({ where: { routerId, username } });
  for (const action of ['SUSPEND', 'REACTIVATE', 'PASSWORD', 'PLAN', 'DISCONNECT']) {
    const result = await api('/api/mikrotik/jobs', 'POST', { action, routerId, subscriberId: sub.id, ...(action === 'PASSWORD' ? { password: randomUUID() } : {}), ...(action === 'PLAN' ? { planId: plan.id } : {}) }); assert.equal(result.status, 202, JSON.stringify(result.data));
    await finish(result.data.job.id);
    if (action === 'SUSPEND') assert.equal((await rt.get('/ppp/secret?name=' + username))[0].disabled, 'true');
    if (action === 'REACTIVATE') assert.equal((await rt.get('/ppp/secret?name=' + username))[0].disabled, 'false');
    console.log('OK ação real:', action);
  }
  await prisma.mikrotikRouter.update({ where: { id: routerId }, data: { lastSeenAt: new Date(Date.now() - 120000) } });
  const offline = await api('/api/mikrotik'); assert.equal(offline.data.routers[0].snapshot, null); assert.equal(offline.data.routers[0].online, false);
  console.log('OK perda do agente remove dados atuais; sem sessões ou métricas fictícias');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(async () => {
  // Só elimina artefatos criados por este teste; nunca usa nomes de clientes existentes.
  if (username.startsWith('isp-it-')) { const secret = (await rt.get('/ppp/secret?name=' + username))[0]; if (secret?.comment?.startsWith('isp-manager:')) await rt.del('/ppp/secret/' + encodeURIComponent(secret['.id'])); }
  if (profile.startsWith('isp-')) { const p = (await rt.get('/ppp/profile?name=' + profile))[0]; if (p) await rt.del('/ppp/profile/' + encodeURIComponent(p['.id'])); }
  for (const id of [orgId, foreignId].filter(Boolean)) {
    await prisma.mikrotikJob.deleteMany({ where: { organizationId: id } }); await prisma.mikrotikSubscriber.deleteMany({ where: { organizationId: id } }); await prisma.mikrotikRouter.deleteMany({ where: { organizationId: id } }); await prisma.auditEvent.deleteMany({ where: { organizationId: id } }); await prisma.user.deleteMany({ where: { organizationId: id } }); await prisma.organization.delete({ where: { id } });
  }
  fs.rmSync(outbox, { recursive: true, force: true }); await prisma.$disconnect();
});
