'use strict';
// Só restaura em um schema NOVO da base isolada de testes. Nunca no banco real.
const fs = require('node:fs'), crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const base = 'C:/mikrotik-lab/backups';
const stateFile = base + '/mikrotik-cloud-setup.json';
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const backup = JSON.parse(fs.readFileSync(state.backupPath, 'utf8'));
const keys = JSON.parse(fs.readFileSync(base + '/mikrotik-cloud-keys.json', 'utf8'));
const [iv, tag, data] = backup.cipher.split('.').map(s => Buffer.from(s, 'base64'));
const cipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keys.previewKey, 'base64'), iv); cipher.setAuthTag(tag);
const dump = JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8'));
if (dump.format !== 'isp-pg-backup-v1' || !/^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/isp_test\?schema=cloud_restore(?:_after|_lifecycle_before|_lifecycle_after)?$/.test(process.env.DATABASE_URL || '')) throw new Error('Destino de restauração deve ser exclusivamente o schema cloud_restore da base isolada.');
const prisma = new PrismaClient(); const quote = s => '"' + s.replace(/"/g, '""') + '"';
(async () => {
  const pending = Object.keys(dump.data).filter(t => t !== '_prisma_migrations'); const done = new Set();
  const order = [];
  while (pending.length) {
    const index = pending.findIndex(t => dump.constraints.filter(c => c.table_name.replaceAll('"', '') === t && c.definition.startsWith('FOREIGN KEY')).every(c => {
      const ref = /REFERENCES\s+(?:"?\w+"?\.)?"?([A-Za-z0-9_]+)"?\(/.exec(c.definition)?.[1]; return !ref || ref === t || done.has(ref) || !pending.includes(ref);
    }));
    if (index < 0) throw new Error('Dependência circular requer restauração especializada; migração bloqueada.');
    const [table] = pending.splice(index, 1); order.push(table); done.add(table);
  }
  await prisma.$transaction(async tx => {
    // O banco publicado pode usar timestamptz(6), enquanto o schema Prisma usa
    // timestamp(3). Reproduzimos os tipos originais no destino vazio para não
    // perder fuso/precisão na verificação do backup.
    const types = new Set(['text', 'boolean', 'integer', 'bigint', 'smallint', 'real', 'double precision', 'json', 'jsonb', 'bytea', 'date', 'uuid']);
    for (const c of dump.columns.filter(c => c.table_name !== '_prisma_migrations')) {
      let type;
      if (types.has(c.data_type)) type = c.data_type;
      else if (['timestamp with time zone', 'timestamp without time zone', 'time with time zone', 'time without time zone'].includes(c.data_type)) type = c.data_type.replace(/^(timestamp|time)/, '$1(' + Number(c.datetime_precision ?? 6) + ')');
      else if (c.data_type === 'numeric') type = c.numeric_precision ? `numeric(${Number(c.numeric_precision)},${Number(c.numeric_scale || 0)})` : 'numeric';
      else if (['character varying', 'character'].includes(c.data_type)) type = c.data_type + (c.character_maximum_length ? '(' + Number(c.character_maximum_length) + ')' : '');
      else throw new Error('Tipo exige restauração especializada: ' + c.data_type);
      await tx.$executeRawUnsafe(`ALTER TABLE ${quote(c.table_name)} ALTER COLUMN ${quote(c.column_name)} TYPE ${type}`);
    }
    for (const table of order) {
      const count = await tx.$queryRawUnsafe(`SELECT count(*) AS n FROM ${quote(table)}`);
      if (Number(count[0].n) !== 0) throw new Error('Destino de restauração não está vazio; operação recusada.');
      const rows = dump.data[table];
      if (rows.length) await tx.$executeRawUnsafe(`INSERT INTO ${quote(table)} SELECT * FROM json_populate_recordset(NULL::${quote(table)}, $1::json)`, JSON.stringify(rows));
      const restored = await tx.$queryRawUnsafe(`SELECT row_to_json(t) AS row FROM ${quote(table)} t`);
      const normalize = a => a.map(v => JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))))).sort();
      if (JSON.stringify(normalize(restored.map(r => r.row))) !== JSON.stringify(normalize(rows))) throw new Error('Divergência ao restaurar ' + table);
    }
  }, { timeout: 60000 });
  state.restoredAndVerified = true; state.restoreVerification = { at: new Date().toISOString(), tables: order.length, records: order.reduce((n, t) => n + dump.data[t].length, 0) };
  fs.writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
  console.log('Backup restaurado e comparado registro a registro:', JSON.stringify(state.restoreVerification));
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
