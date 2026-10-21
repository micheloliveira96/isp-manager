import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

async function validSession(token?: string) {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret || secret.length < 32) return { valid: false, mustChangePassword: false, role: "" };
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return { valid: true, mustChangePassword: payload.mustChangePassword === true, role: typeof payload.role === "string" ? payload.role : "" };
  } catch {
    return { valid: false, mustChangePassword: false, role: "" };
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/login") ||
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/logout") ||
    path.startsWith("/api/auth/change-password") ||
    path.startsWith("/api/public/branding") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico"
  ) return NextResponse.next();

  const session = await validSession(request.cookies.get("isp_session")?.value);
  if (!session.valid) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.mustChangePassword && path !== "/alterar-palavra-passe") {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Altere a palavra-passe antes de continuar." }, { status: 403 });
    return NextResponse.redirect(new URL("/alterar-palavra-passe", request.url));
  }

  if (!session.mustChangePassword && path === "/alterar-palavra-passe") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Técnicos não podem abrir páginas de administração pela URL direta.
  if (session.role === "TECHNICIAN" && !path.startsWith("/api/")) {
    const allowed = ["/tecnico", "/tecnicos", "/ordens", "/estoque", "/frota"];
    if (!allowed.some(prefix => path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "#"))) {
      return NextResponse.redirect(new URL("/tecnicos", request.url));
    }
  }
  if (session.role === "TECHNICIAN" && path === "/") {
    return NextResponse.redirect(new URL("/tecnicos", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!.*\\..*).*)"] };
