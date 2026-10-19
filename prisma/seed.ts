import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.INITIAL_ADMIN_NAME || "Administrador";
  const email = (process.env.INITIAL_ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!password || password.length < 12 || password === "change-this-immediately") {
    throw new Error("Defina INITIAL_ADMIN_PASSWORD com pelo menos 12 caracteres, diferente do valor de exemplo.");
  }
  const organization = await prisma.organization.upsert({
    where: { slug: "empresa-principal" },
    update: {},
    create: { name: process.env.COMPANY_NAME || "Minha empresa", slug: "empresa-principal" }
  });
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { organizationId_email: { organizationId: organization.id, email } },
    update: { name, passwordHash, role: "MANAGER", active: true, mustChangePassword: true },
    create: { organizationId: organization.id, name, email, passwordHash, role: "MANAGER", active: true, mustChangePassword: true }
  });
  await prisma.brandingSettings.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: { organizationId: organization.id, systemName: "ISP Manager", welcomeTitle: "Gestão operacional", welcomeMessage: "Acompanhe a operação da sua equipa." }
  });
  console.log("Gestor inicial criado/atualizado para", email, "— altere as credenciais de ambiente após o primeiro acesso.");
}
main().finally(async () => prisma.$disconnect());
