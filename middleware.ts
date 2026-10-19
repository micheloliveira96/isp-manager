import { NextRequest, NextResponse } from "next/server";
import { readToken } from "./src/lib/session";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/login") || path.startsWith("/api/auth/login") || path.startsWith("/api/auth/logout") || path.startsWith("/_next") || path === "/favicon.ico") return NextResponse.next();
  const token = request.cookies.get("isp_session")?.value;
  const session = token ? await readToken(token) : null;
  if (!session) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!.*\\..*).*)"] };
