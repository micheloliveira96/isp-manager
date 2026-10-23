const cp = require('node:child_process');
if(!/^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/isp_test\?schema=integration$/.test(process.env.DATABASE_URL || '')) throw new Error('Execute com o ambiente isolado .env.test');
const after = process.argv.includes('--after');
process.env.DATABASE_URL = process.env.DATABASE_URL.replace('schema=integration', after ? 'schema=cloud_restore_lifecycle_after' : 'schema=cloud_restore_lifecycle_before');
let result = cp.spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--schema', after ? 'prisma/schema.prisma' : 'C:/mikrotik-lab/backups/schema-antes-ciclo-clientes.prisma', '--skip-generate'], {stdio: 'inherit', env: process.env});
if(result.status !== 0) process.exit(result.status || 1);
result = cp.spawnSync(process.execPath, ['scripts/verify-cloud-backup.cjs'], {stdio: 'inherit', env: process.env});
process.exitCode = result.status || 0;
