const fs = require('node:fs'), assert = require('node:assert/strict'), {PrismaClient} = require('@prisma/client');
if(!/^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/isp_test\?schema=integration$/.test(process.env.DATABASE_URL || '')) throw Error('Use somente .env.test');
const url = process.env.DATABASE_URL.replace('schema=integration','schema=cloud_restore_lifecycle_before');
const db = new PrismaClient({datasources:{db:{url}}});
const fields = {Client:['installationState','installationConfirmedAt','installationConfirmedBy'],MikrotikSubscriber:['managedLifecycle','credentialCipher','accessState','syncState','syncMessage','revision','graceStartedAt','graceExpiresAt'],MikrotikJob:['lifecycleRevision','lifecycleTarget','retryAt','attempts']};
const normalize = (rows,omit=[]) => rows.map(({row})=>JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k])=>!omit.includes(k)).sort(([a],[b])=>a.localeCompare(b))))).sort();
(async()=>{
 await db.$transaction(async tx=>{
  const before={};for(const table of Object.keys(fields))before[table]=await tx.$queryRawUnsafe(`SELECT row_to_json(t) AS row FROM "${table}" t`);
  const sql=fs.readFileSync('prisma/migrations/20261023070000_client_access_lifecycle/migration.sql','utf8');
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
  for(const [table,omit] of Object.entries(fields)) {const after=await tx.$queryRawUnsafe(`SELECT row_to_json(t) AS row FROM "${table}" t`);assert.deepEqual(normalize(after,omit),normalize(before[table]));}
  assert.equal(await tx.client.count({where:{installationState:{not:'LEGACY'}}}),0);
  assert.equal(await tx.mikrotikSubscriber.count({where:{managedLifecycle:true}}),0);
 },{timeout:30000});
 console.log('Migração SQL testada sobre o backup restaurado; todos os campos anteriores preservados e nenhum legado gerenciado automaticamente.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
