'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { execute, collect } = require('./operations');

async function start() {
  const cloud = new URL(process.env.ISP_URL || '');
  if (cloud.protocol !== 'https:' && !(process.env.AGENT_TEST === '1' && cloud.hostname === '127.0.0.1')) throw new Error('ISP_URL deve usar HTTPS');
  if (cloud.username || cloud.password || cloud.pathname !== '/' || cloud.search || cloud.hash) throw new Error('Informe somente a origem HTTPS do ISP Manager');
  const gateway = new URL(process.env.GATEWAY_URL || 'http://mikrotik-gateway:8088');
  if (!['http:', 'https:'].includes(gateway.protocol) || gateway.username || gateway.password) throw new Error('Gateway inválido');
  const agentToken = process.env.ISP_AGENT_TOKEN;
  if (!/^[A-Za-z0-9_-]{43}$/.test(agentToken || '')) throw new Error('Token do agente inválido');
  const gatewayToken = process.env.GATEWAY_TOKEN;
  if (!gatewayToken || gatewayToken.length < 32) throw new Error('Token do gateway ausente');
  const dataDir = process.env.AGENT_DATA_DIR || '/data'; fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const journal = path.join(dataDir, 'outbox.json');
  const save = value => { fs.writeFileSync(journal + '.tmp', JSON.stringify(value), { mode: 0o600 }); fs.renameSync(journal + '.tmp', journal); };
  const read = () => fs.existsSync(journal) ? JSON.parse(fs.readFileSync(journal, 'utf8')) : null;
  async function request(url, credential, options = {}) {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000), ...options, headers: { Authorization: 'Bearer ' + credential, 'Content-Type': 'application/json' } });
    if (!response.ok) throw Object.assign(new Error('HTTP ' + response.status), { status: response.status });
    return response.json();
  }
  const gw = (method, p, body) => request(new URL(p, gateway), gatewayToken, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
  const send = body => request(new URL('/api/mikrotik/agent', cloud), agentToken, { method: 'POST', body: JSON.stringify(body) });
  const snapshotClock = path.join(dataDir, 'snapshot-at');
  let lastSnapshot = fs.existsSync(snapshotClock) ? Number(fs.readFileSync(snapshotClock, 'utf8')) || 0 : 0;
  console.log('Agente ISP Manager iniciado; somente conexão de saída.');
  while (true) {
    try {
      let pending = read();
      if (pending) {
        // Se houve queda durante a execução, não repetir a escrita automaticamente.
        if (pending.stage === 'started') { pending = { ...pending, stage: 'done', result: { ok: false, code: 'UNCERTAIN' } }; save(pending); }
        await send({ type: 'ack', jobId: pending.id, lease: pending.lease, result: pending.result });
        fs.unlinkSync(journal);
      }
      const snapshot = Date.now() - lastSnapshot >= 30000 ? await collect(gw) : undefined;
      if (snapshot) lastSnapshot = Date.now();
      const reply = await send({ type: 'poll', protocolVersion: 2, ...(snapshot ? { snapshot } : {}) });
      if (snapshot) fs.writeFileSync(snapshotClock, String(lastSnapshot));
      if (reply.job) {
        const job = reply.job;
        save({ id: job.id, lease: job.lease, stage: 'started' });
        let result;
        const guardedGateway = async (method, p, body) => {
          if(job.action.startsWith('ACCESS_') && method !== 'GET') await send({type: 'authorize', jobId: job.id, lease: job.lease});
          return gw(method, p, body);
        };
        try { await execute(job, guardedGateway); result = { ok: true, code: 'CONFIRMED' }; }
        catch (e) { result = { ok: false, code: e.status === 409 ? 'OWNERSHIP_CONFLICT' : e.status === 422 ? 'RADIUS_UNSUPPORTED' : 'NOT_CONFIRMED' }; }
        save({ id: job.id, lease: job.lease, stage: 'done', result });
        console.log('Operação', job.id, result.code);
        lastSnapshot = 0;
        fs.writeFileSync(snapshotClock, '0');
      }
      fs.writeFileSync(path.join(dataDir, 'heartbeat'), String(Date.now()));
    } catch (e) { console.error('Comunicação indisponível; nova tentativa em 10s.', e.status ? 'HTTP ' + e.status : 'Falha de transporte ou configuração'); }
    if (process.env.AGENT_ONCE === '1') break;
    await delay(10000);
  }
}
if (require.main === module) start().catch(() => { console.error('Configuração inválida do agente; consulte o guia local.'); process.exitCode = 1; });
module.exports = { start };
