import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "isp_session";
function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET tem de ter pelo menos 32 caracteres.");
  return new TextEncoder().encode(secret);
}
export type SessionUser = { userId: string; organizationId: string; role: string; name: string; email: string; mustChangePassword?: boolean };
export async function createSession(user: SessionUser) {
  return new SignJWT(user).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(secretKey());
}
export async function readToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.userId !== "string" || typeof payload.organizationId !== "string" || typeof payload.role !== "string") return null;
    return { userId: payload.userId, organizationId: payload.organizationId, role: payload.role, name: String(payload.name || ""), email: String(payload.email || "") };
  } catch { return null; }
}
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const claims = token ? await readToken(token) : null;
  if (!claims) return null;
  const user = await prisma.user.findFirst({
    where: { id: claims.userId, organizationId: claims.organizationId, active: true, organization: { status: "active" } },
    select: { id: true, organizationId: true, role: true, name: true, email: true }
  });
  if (!user) return null;
  return { userId: user.id, organizationId: user.organizationId, role: user.role, name: user.name, email: user.email, mustChangePassword: false };
}
export const sessionCookieName = COOKIE_NAME;
export const sessionCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 8 };
export const permissionCatalog = [
  { code: "clients.view", label: "Consultar clientes e situação do acesso" },
  { code: "clients.manage", label: "Cadastrar e editar clientes" },
  { code: "clients.credentials", label: "Cadastrar, consultar e editar credenciais PPPoE" },
  { code: "clients.install", label: "Confirmar instalação de cliente" },
  { code: "clients.activate", label: "Ativar definitivamente o acesso" },
  { code: "clients.suspend", label: "Desativar o acesso" },
  { code: "clients.grace", label: "Conceder 72 horas de carência" },
  { code: "mikrotik.view", label: "Consultar MikroTik e sessões PPPoE" },
  { code: "mikrotik.manage", label: "Cadastrar roteadores e renovar agente MikroTik" },
  { code: "mikrotik.provision", label: "Provisionar PPPoE, senhas e planos MikroTik" },
  { code: "mikrotik.suspend", label: "Bloquear e desbloquear PPPoE no MikroTik" },
  { code: "orders.view", label: "Consultar ordens" },
  { code: "orders.create", label: "Criar ordens" },
  { code: "orders.update", label: "Atualizar e atribuir ordens" },
  { code: "orders.approve", label: "Aprovar e encerrar ordens" },
  { code: "users.manage", label: "Gerir utilizadores" },
  { code: "branding.manage", label: "Personalizar a empresa" },
  { code: "audit.view", label: "Consultar auditoria" }
] as const;

const roleDefaults: Record<string, string[]> = {
  MANAGER: permissionCatalog.map(p => p.code),
  ATTENDANT: ["clients.view", "orders.view", "orders.create", "orders.update"],
  TECHNICIAN: ["orders.view", "orders.update"]
};

export async function hasPermission(session: SessionUser, permissionCode: string): Promise<boolean> {
  if (session.role === "MANAGER") return true;
  const override = await prisma.userPermission.findUnique({
    where: { userId_permissionCode: { userId: session.userId, permissionCode } },
    select: { allowed: true }
  });
  if (override) return override.allowed;
  return (roleDefaults[session.role] || []).includes(permissionCode);
}
