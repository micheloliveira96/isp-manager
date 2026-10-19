import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { readToken, createSession, sessionCookieName, sessionCookieOptions } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(sessionCookieName)?.value;
    const session = token ? await readToken(token) : null;
    if (!session) return NextResponse.json({ error: "Sessão inválida. Inicia sessão novamente." }, { status: 401 });
    const body = await request.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (newPassword.length < 12 || newPassword.length > 200) return NextResponse.json({ error: "A nova palavra-passe deve ter pelo menos 12 caracteres." }, { status: 400 });
    const user = await prisma.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, active: true } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return NextResponse.json({ error: "A palavra-passe atual está incorreta." }, { status: 400 });
    if (await bcrypt.compare(newPassword, user.passwordHash)) return NextResponse.json({ error: "Escolhe uma palavra-passe diferente da atual." }, { status: 400 });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    const newToken = await createSession({ userId: user.id, organizationId: user.organizationId, role: user.role, name: user.name, email: user.email, mustChangePassword: false });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookieName, newToken, sessionCookieOptions);
    await prisma.auditEvent.create({ data: { organizationId: user.organizationId, actorUserId: user.id, action: "PASSWORD_CHANGED", entityType: "User", entityId: user.id } });
    return response;
  } catch (error) {
    console.error("Password change failed", error);
    return NextResponse.json({ error: "Não foi possível alterar a palavra-passe." }, { status: 500 });
  }
}