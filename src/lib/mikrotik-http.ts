import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/session";
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function access(permission: string, req?: NextRequest) {
  const s = await getSession();
  if (!s) throw new ApiError(401, "Faça login para continuar.");
  if (!(await hasPermission(s, permission))) throw new ApiError(403, "Sem permissão para esta operação MikroTik.");
  if (req && req.headers.get("origin") && req.headers.get("origin") !== req.nextUrl.origin) throw new ApiError(403, "Origem não autorizada.");
  return s;
}
export async function body(req: NextRequest) {
  const reader = req.body?.getReader(); if (!reader) throw new ApiError(400, "JSON obrigatório.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const row = await reader.read(); if (row.done) break; size += row.value.length; if (size > 1000000) { await reader.cancel(); throw new ApiError(413, "Requisição muito grande."); } chunks.push(row.value); }
  try { const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); return parsed as Record<string, unknown>; } catch { throw new ApiError(400, "JSON inválido."); }
}
export function fail(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Cadastro ou operação duplicada." }, { status: 409 });
  return NextResponse.json({ error: "Não foi possível concluir a operação. Verifique a configuração da integração no servidor." }, { status: 500 });
}
