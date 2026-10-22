'use strict';
// Operador temporário: autentica pela CLI Vercel; segredos ficam só em arquivo privado.
const fs = require('node:fs'), cp = require('node:child_process'), crypto = require('node:crypto');
const action = process.argv[2], deployment = process.argv[3];
if (!['info', 'backup', 'migrate', 'register', 'verify', 'probe'].includes(action) || !/^https:\/\/isp-manager-[a-z0-9-]+\.vercel\.app$/.test(deployment || '')) throw new Error('Uso: node scripts/cloud-maintenance.cjs <acao> <URL exata do preview>');
const directory = 'C:/mikrotik-lab/backups';
const config = JSON.parse(fs.readFileSync(directory + '/mikrotik-cloud-keys.json', 'utf8'));
const statePath = directory + '/mikrotik-cloud-setup.json';
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
let data = { action };
if (action === 'migrate') {
  if (!state.backupPath || !fs.existsSync(state.backupPath) || !state.restoredAndVerified) throw new Error('Backup local e teste de restauração obrigatórios antes de migrar.');
  const backup = JSON.parse(fs.readFileSync(state.backupPath, 'utf8'));
  if (crypto.createHash('sha256').update(backup.cipher).digest('hex') !== JSON.parse(backup.proof).digest) throw new Error('Backup alterado');
  data = { ...data, proof: backup.proof, signature: backup.signature };
}
if (action === 'register') {
  const info = state.info;
  const organizations = info?.organizations?.filter(o => o.status === 'active');
  if (organizations?.length !== 1) throw new Error('Selecione explicitamente a empresa; configuração automática exige uma única empresa ativa.');
  data.organizationId = organizations[0].id;
}
if (action === 'verify' || action === 'probe') data.routerId = state.registration?.router?.id;
if (action === 'probe') { const iv=crypto.randomBytes(12), c=crypto.createCipheriv('aes-256-gcm',Buffer.from(config.productionKey,'base64'),iv); const body=Buffer.concat([c.update('{}'),c.final()]); data.cipher=[iv,c.getAuthTag(),body].map(v=>v.toString('base64')).join('.'); }
const requestPath = directory + '/.maintenance-request.json', curlConfig = directory + '/.maintenance-curl.conf';
fs.writeFileSync(requestPath, JSON.stringify(data), { mode: 0o600 });
fs.writeFileSync(curlConfig, `silent\nshow-error\nfail-with-body\nrequest = "POST"\nheader = "Authorization: Bearer ${config.setupToken}"\nheader = "Content-Type: application/json"\ndata-binary = "@${requestPath}"\n`, { mode: 0o600 });
try {
  const result = cp.spawnSync('cmd.exe', ['/d', '/s', '/c', `npm.cmd exec --yes --package=vercel@65.1.0 -- vercel --scope micheloliveira96 curl ${deployment}/api/internal/mikrotik-setup -- --config ${curlConfig}`], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, timeout: 120000 });
  let response; try { response = JSON.parse(result.stdout); } catch { console.error('Resposta inválida da manutenção. HTTP/CLI:', result.status); console.error(result.stderr); process.exit(1); }
  if (result.status !== 0 || response.error) { console.error('Manutenção falhou:', response.error || result.status); process.exit(1); }
  if (action === 'backup') {
    const backupPath = directory + '/isp-manager-cloud-' + new Date().toISOString().replace(/[:.]/g, '-') + '.encrypted.json';
    fs.writeFileSync(backupPath, JSON.stringify(response), { mode: 0o600 }); state.backupPath = backupPath; state.restoredAndVerified = false;
    console.log('Backup cifrado salvo:', backupPath, 'bytes:', fs.statSync(backupPath).size);
  } else if (action === 'info') { state.info = response; console.log(JSON.stringify(response)); }
  else if (action === 'register') { state.registration = response; console.log('Roteador cadastrado; chave do agente salva sem divulgação.'); }
  else if (action === 'verify') {
    state.verification = response;
    const r = response.router; console.log(JSON.stringify({ probe: response.probe, name: r?.name, online: r?.routerOnline, lastSeenAt: r?.lastSeenAt, identity: r?.snapshot?.identity, resource: r?.snapshot?.resource, realSessions: r?.snapshot?.sessions?.map(s => ({ name: s.name, address: s.address })) }));
  } else { state.migration = response; console.log(JSON.stringify(response)); }
  fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
} finally { fs.unlinkSync(requestPath); fs.unlinkSync(curlConfig); }
