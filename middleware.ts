import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

async function validSession(token?:string) {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret || secret.length < 32) return false;
  try { await jwtVerify(token, new TextEncoder().encode(secret)); return true; } catch { return false; }
}
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/login") || path.startsWith("/api/auth/login") || path.startsWith("/api/auth/logout") || path.startsWith("/_next") || path === "/favicon.ico") return NextResponse.next();
  if (!(await validSession(request.cookies.get("isp_session")?.value))) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!.*\\..*).*)"] };
