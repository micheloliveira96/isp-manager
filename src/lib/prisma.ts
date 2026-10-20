import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL não está configurada.");

  const url = new URL(raw);
  // Limita as ligações por instância serverless para evitar esgotar o pool PostgreSQL.
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
  return url.toString();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasources: { db: { url: getDatabaseUrl() } } });

globalForPrisma.prisma = prisma;
