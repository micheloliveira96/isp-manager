import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

async function readSession(token?: string) {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret || secret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (typeof payload.userId !== "string" || typeof payload.organizationId !== "string") return null;
    return {
      userId: payload.userId,
      role: typeof payload.role === "string" ? payload.role : "",
      mustChangePassword: payload.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}

const PUBLIC_PATHS = new Set([
  "/api/mikrotik/agent",
  "/login",
  "/login/tecnicos",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/change-password",
  "/api/public/branding",
]);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Only explicitly listed authentication/public endpoints are accessible without a session.
  if (PUBLIC_PATHS.has(path) || path.startsWith("/_next/") || path === "/favicon.ico") {
    const existingSession = await readSession(request.cookies.get("isp_session")?.value);
    if (existingSession && !existingSession.mustChangePassword) {
      if (path === "/login/tecnicos") {
        return existingSession.role === "TECHNICIAN"
          ? NextResponse.redirect(new URL("/tecnicos", request.url))
          : NextResponse.next();
      }
      if (path === "/login" && existingSession.role === "TECHNICIAN") {
        return NextResponse.redirect(new URL("/tecnicos", request.url));
      }
    }
    return NextResponse.next();
  }

  const session = await readSession(request.cookies.get("isp_session")?.value);
  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.mustChangePassword && path !== "/alterar-palavra-passe") {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Altere a palavra-passe antes de continuar." }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/alterar-palavra-passe", request.url));
  }

  if (!session.mustChangePassword && path === "/alterar-palavra-passe") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (session.role === "TECHNICIAN") {
    const allowed = ["/clientes", "/api/clients", "/tecnico", "/tecnicos", "/ordens", "/estoque", "/frota", "/api/auth/me", "/api/auth/logout", "/api/auth/change-password", "/api/orders", "/api/attendance", "/api/inventory", "/api/fleet"];
    const isAllowed = allowed.some(prefix => path === prefix || path.startsWith(prefix + "/"));
    if (!isAllowed) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "Acesso não autorizado para técnicos." }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/tecnicos", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
