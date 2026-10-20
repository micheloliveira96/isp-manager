import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  // Next.js imports API routes while collecting build metadata. This placeholder is only for build-time initialization; runtime still requires the real DATABASE_URL.\n  if (!raw) {\n    if (process.env.NEXT_PHASE === "phase-production-build") return "postgresql://build:build@127.0.0.1:5432/build?schema=public";\n    throw new Error("DATABASE_URL não está configurada.");\n  }
  const url = new URL(raw);
  // Limita as ligações por instância serverless para evitar esgotar o pool PostgreSQL.
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
  return url.toString();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasources: { db: { url: getDatabaseUrl() } } });

globalForPrisma.prisma = prisma;
