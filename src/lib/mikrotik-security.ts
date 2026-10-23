import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
export const OFFLINE_MESSAGE = "MikroTik indisponível — sem dados de monitoramento.";
export const ACTIONS = ["PROVISION", "PASSWORD", "PLAN", "SUSPEND", "REACTIVATE", "DISCONNECT", "SYNC_PLAN", "REFRESH"] as const;
export type MikrotikAction = typeof ACTIONS[number];
export type Command = { username?: string; password?: string; profile?: string; downMbps?: number; upMbps?: number; owner?: string; planId?: string };
function key() {
  const value = Buffer.from(process.env.MIKROTIK_ENCRYPTION_KEY || "", "base64");
  if (value.length !== 32) throw new Error("Configure MIKROTIK_ENCRYPTION_KEY com 32 bytes em base64 no servidor.");
  return value;
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(b => b.toString("base64")).join(".");
}
export function decrypt(value: string): Command {
  const [iv, tag, body] = value.split(".").map(s => Buffer.from(s, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv); cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(body), cipher.final()]).toString("utf8"));
}
export const token = () => randomBytes(32).toString("base64url");
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const fingerprint = (value: unknown) => createHmac("sha256", key()).update(JSON.stringify(value)).digest("hex");
export function name(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(value)) throw new Error("Login PPPoE inválido: use até 64 letras, números, ponto, hífen ou sublinhado.");
  return value;
}
export function password(value: unknown) {
  if (typeof value !== "string" || value.length < 8 || value.length > 64 || /[\u0000-\u001f]/.test(value)) throw new Error("Senha PPPoE deve ter de 8 a 64 caracteres, sem caracteres de controle.");
  return value;
}
export function speed(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 10000) throw new Error("Velocidade deve estar entre 1 e 10000 Mbps.");
  return value;
}
export const fresh = (at: Date | null, now = Date.now()) => !!at && now - at.getTime() < 90000 && now >= at.getTime();
export function safeResult(value: unknown) {
  const obj = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { ok: obj.ok === true, code: typeof obj.code === "string" && /^[A-Z_]{1,40}$/.test(obj.code) ? obj.code : "UNKNOWN", message: obj.ok === true ? "Operação confirmada no MikroTik." : "Operação não confirmada. Consulte o agente local antes de tentar novamente." };
}
const fields = (value: unknown, keys: string[]) => {
  const obj = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(keys.filter(k => typeof obj[k] === "string" || typeof obj[k] === "number" || typeof obj[k] === "boolean").map(k => [k, String(obj[k]).slice(0, 256)]));
};
export function safeSnapshot(value: unknown) {
  const obj = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (obj.online !== true) return { online: false };
  const list = (v: unknown, keys: string[]) => Array.isArray(v) ? v.slice(0, 1000).map(row => fields(row, keys)) : [];
  return { online: true, authSource: obj.authSource === "LOCAL" ? "LOCAL" : obj.authSource === "RADIUS" ? "RADIUS" : "UNKNOWN", identity: fields(obj.identity, ["name"]), resource: fields(obj.resource, ["version", "uptime", "cpu-load", "free-memory", "total-memory", "board-name"]), interfaces: list(obj.interfaces, ["name", "type", "running", "disabled", "rx-byte", "tx-byte"]), sessions: list(obj.sessions, ["name", "address", "uptime", "caller-id", "service", "bytes-in", "bytes-out"]), users: list(obj.users, ["name", "profile", "disabled", "service", "comment"]), profiles: list(obj.profiles, ["name", "rate-limit"]) };
}
