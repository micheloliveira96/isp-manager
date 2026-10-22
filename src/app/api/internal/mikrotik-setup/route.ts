// Temporário: apenas Preview, token aleatório e expiração. Remover antes do release.
import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, hash, token } from "@/lib/mikrotik-security";
import { ApiError, body, fail } from "@/lib/mikrotik-http";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';
const migrationName = '20261023000100_mikrotik_connector';
function receipt(value: string) { return createHmac('sha256', process.env.MIKROTIK_SETUP_TOKEN!).update(value).digest('hex'); }
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.MIKROTIK_SETUP_TOKEN || '';
    const expires = Date.parse(process.env.MIKROTIK_SETUP_EXPIRES || '');
    if (process.env.VERCEL_ENV !== 'preview' || secret.length < 40 || !Number.isFinite(expires) || Date.now() > expires) throw new ApiError(404, 'Não encontrado.');
    const got = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
    if (!timingSafeEqual(Buffer.from(hash(got)), Buffer.from(hash(secret)))) throw new ApiError(401, 'Não autorizado.');
    const b = await body(req);
    if (b.action === 'info') {
      const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename`;
      return NextResponse.json({ tables: tables.map(t => t.tablename), organizations: await prisma.organization.findMany({ select: { id: true, name: true, status: true } }) });
    }
    if (b.action === 'backup') {
      const dump = await prisma.$transaction(async tx => {
        const tables = await tx.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename`;
        const data: Record<string, unknown[]> = {};
        for (const t of tables) { const rows = await tx.$queryRawUnsafe<{ row: unknown }[]>(`SELECT row_to_json(t) AS row FROM ${quote(t.tablename)} t`); data[t.tablename] = rows.map(r => r.row); }
        const columns = await tx.$queryRaw`SELECT * FROM information_schema.columns WHERE table_schema = current_schema()`;
        const constraints = await tx.$queryRaw`SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace = current_schema()::regnamespace`;
        const indexes = await tx.$queryRaw`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema()`;
        return { format: 'isp-pg-backup-v1', createdAt: new Date().toISOString(), data, columns, constraints, indexes };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 50000 });
      const cipher = encrypt(dump), digest = createHash('sha256').update(cipher).digest('hex');
      const counts = Object.fromEntries(Object.entries(dump.data).map(([name, rows]) => [name, rows.length]));
      const proof = JSON.stringify({ digest, counts, at: Date.now() });
      return NextResponse.json({ cipher, proof, signature: receipt(proof) }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (b.action === 'migrate') {
      const proof = String(b.proof || '');
      if (receipt(proof) !== b.signature) throw new ApiError(400, 'Backup obrigatório.');
      const before = JSON.parse(proof) as { counts: Record<string, number>; at: number };
      if (Date.now() - before.at > 3600000) throw new ApiError(400, 'Refaça o backup.');
      const sql = fs.readFileSync(path.join(process.cwd(), 'prisma/migrations/' + migrationName + '/migration.sql'), 'utf8');
      const result = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(23007701)`;
        const present = await tx.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename IN ('MikrotikRouter','MikrotikSubscriber','MikrotikJob')`;
        if (present.length !== 0) throw new ApiError(409, 'Tabelas já existem; migração não repetida.');
        for (const [table, count] of Object.entries(before.counts)) {
          const rows = await tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM ${quote(table)}`);
          if (Number(rows[0].count) !== count) throw new ApiError(409, 'Dados mudaram após o backup; gere um novo backup.');
        }
        // SQL gerado e versionado, sem entrada SQL do solicitante.
        for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
        if ('_prisma_migrations' in before.counts) {
          const checksum = createHash('sha256').update(sql).digest('hex');
          await tx.$executeRaw`INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count) VALUES (${randomUUID()}, ${checksum}, ${migrationName}, now(), now(), 1)`;
        }
        return { originalTableCountsPreserved: true, tablesAdded: 3 };
      }, { timeout: 50000 });
      return NextResponse.json(result);
    }
    if (b.action === 'register') {
      const organizations = await prisma.organization.findMany({ where: { status: 'active' }, select: { id: true } });
      const organizationId = String(b.organizationId || '');
      if (!organizations.some(o => o.id === organizationId)) throw new ApiError(400, 'Empresa inválida.');
      const agentToken = token();
      const router = await prisma.mikrotikRouter.create({ data: { organizationId, name: 'CHR laboratório', agentTokenHash: hash(agentToken) }, select: { id: true, name: true } });
      await prisma.auditEvent.create({ data: { organizationId, action: 'MIKROTIK_INITIAL_AGENT_SETUP', entityType: 'MikrotikRouter', entityId: router.id } });
      return NextResponse.json({ router, agentToken }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (b.action === 'verify') {
      const router = await prisma.mikrotikRouter.findUnique({ where: { id: String(b.routerId || '') }, select: { name: true, lastSeenAt: true, routerOnline: true, snapshotAt: true, snapshot: true } });
      return NextResponse.json({ router }, { headers: { 'Cache-Control': 'no-store' } });
    }
    throw new ApiError(400, 'Operação não permitida.');
  } catch (e) { return fail(e); }
}
