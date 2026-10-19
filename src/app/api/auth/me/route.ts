import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  const [organization, branding] = await Promise.all([
    prisma.organization.findUnique({ where: { id: session.organizationId }, select: { name: true } }),
    prisma.brandingSettings.findUnique({ where: { organizationId: session.organizationId } })
  ]);
  return NextResponse.json({ user: session, organization, branding });
}
