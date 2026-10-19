import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

async function validSession(token?: string) {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret || secret.length < 32) return { valid: false, mustChangePassword: false };
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return { valid: true, mustChangePassword: payload.mustChangePassword === true };
  } catch {
    return { valid: false, mustChangePassword: false };
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
  return NextResponse.next();
}

export const config = { matcher: ["/((?!.*\\..*).*)"] };
