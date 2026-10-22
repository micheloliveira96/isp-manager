'use strict';
// Salva as chaves localmente e envia pela entrada padrão; nunca em argumentos ou logs.
const fs = require('node:fs'), crypto = require('node:crypto'), cp = require('node:child_process');
const file = 'C:/mikrotik-lab/backups/mikrotik-cloud-keys.json';
if (fs.existsSync(file)) throw new Error('Chaves já existem. Não sobrescrever; confira o procedimento de retomada.');
const values = { productionKey: crypto.randomBytes(32).toString('base64'), previewKey: crypto.randomBytes(32).toString('base64'), setupToken: crypto.randomBytes(48).toString('base64url'), setupExpires: new Date(Date.now() + 60 * 60000).toISOString() };
fs.writeFileSync(file, JSON.stringify(values), { mode: 0o600 });
cp.spawnSync('icacls.exe', [file, '/inheritance:r', '/grant:r', `${process.env.USERDOMAIN}\\${process.env.USERNAME}:(F)`, '*S-1-5-18:(F)'], { stdio: 'ignore' });
for (const [key, target, value] of [['MIKROTIK_ENCRYPTION_KEY', 'production', values.productionKey], ['MIKROTIK_ENCRYPTION_KEY', 'preview', values.previewKey], ['MIKROTIK_SETUP_TOKEN', 'preview', values.setupToken], ['MIKROTIK_SETUP_EXPIRES', 'preview', values.setupExpires]]) {
  const branch = target === 'preview' ? ' --git-branch feature/mikrotik-vercel' : '';
  const result = cp.spawnSync('cmd.exe', ['/d', '/s', '/c', `npm.cmd exec --yes --package=vercel@65.1.0 -- vercel --scope micheloliveira96 env add ${key} --environment ${target} --sensitive --yes${branch}`], { input: value, encoding: 'utf8' });
  if (result.status !== 0) { console.error('Falha ao configurar', key, target, result.stderr); process.exit(1); }
  console.log('Configurado:', key, target);
}
