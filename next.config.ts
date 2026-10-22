import type { NextConfig } from "next";
const nextConfig: NextConfig = { output: "standalone", outputFileTracingIncludes: { "/api/internal/mikrotik-setup": ["prisma/migrations/20261023000100_mikrotik_connector/migration.sql"] } };
export default nextConfig;
