import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const TYPES = ["CLOCK_IN", "BREAK_START", "BREAK_END", "CLOCK_OUT"] as const;
type EventType = typeof TYPES[number];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  try {
    const records = await prisma.attendanceRecord.findMany({
      where: { organizationId: session.organizationId, userId: session.userId },
      orderBy: { occurredAt: "desc" }, take: 100,
      select: { id: true, eventType: true, occurredAt: true, photoData: true, latitude: true, longitude: true, notes: true }
    });
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = records.filter(r => new Date(r.occurredAt) >= todayStart);
    const latest = today.reduce((last, r) => !last || r.occurredAt > last.occurredAt ? r : last, null as typeof today[number] | null);
    const nextByEvent: Record<string, EventType> = {
      "": "CLOCK_IN", CLOCK_IN: "BREAK_START", BREAK_START: "BREAK_END", BREAK_END: "CLOCK_OUT", CLOCK_OUT: "CLOCK_IN"
    };
    return NextResponse.json({ records, nextEvent: nextByEvent[latest?.eventType || ""] || "CLOCK_IN" });
  } catch (error) {
    console.error("Attendance history failed", error);
    return NextResponse.json({ error: "Não foi possível carregar o ponto. Confirma se a migração da base de dados foi aplicada." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  if (session.role !== "TECHNICIAN" && session.role !== "MANAGER") return NextResponse.json({ error: "Só os técnicos podem bater o ponto." }, { status: 403 });
  try {
    const body = await request.json();
    const eventType = String(body.eventType || "") as EventType;
    if (!TYPES.includes(eventType)) return NextResponse.json({ error: "Tipo de batida inválido." }, { status: 400 });
    const photoData = typeof body.photoData === "string" ? body.photoData : "";
    if (!photoData.startsWith("data:image/") || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(photoData) || photoData.length > 1_500_000) {
      return NextResponse.json({ error: "Tira uma fotografia válida (máximo aproximado de 1 MB)." }, { status: 400 });
    }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayRecords = await prisma.attendanceRecord.findMany({
      where: { organizationId: session.organizationId, userId: session.userId, occurredAt: { gte: todayStart } },
      orderBy: { occurredAt: "asc" }, select: { eventType: true }
    });
    const expected = todayRecords.length === 0 ? "CLOCK_IN" : ({
      CLOCK_IN: "BREAK_START", BREAK_START: "BREAK_END", BREAK_END: "CLOCK_OUT", CLOCK_OUT: "CLOCK_IN"
    } as Record<string, string>)[todayRecords[todayRecords.length - 1].eventType];
    if (eventType !== expected) return NextResponse.json({ error: "A próxima batida esperada é: " + ({ CLOCK_IN: "Entrada", BREAK_START: "Início da pausa", BREAK_END: "Regresso da pausa", CLOCK_OUT: "Saída" } as Record<string, string>)[expected] + "." }, { status: 409 });
    const latitude = typeof body.latitude === "number" && Number.isFinite(body.latitude) ? body.latitude : null;
    const longitude = typeof body.longitude === "number" && Number.isFinite(body.longitude) ? body.longitude : null;
    const record = await prisma.attendanceRecord.create({
      data: { organizationId: session.organizationId, userId: session.userId, eventType, photoData, latitude, longitude, notes: typeof body.notes === "string" ? body.notes.slice(0, 1000) : null },
      select: { id: true, eventType: true, occurredAt: true, photoData: true, latitude: true, longitude: true, notes: true }
    });
    return NextResponse.json({ record, message: "Batida registada com sucesso." }, { status: 201 });
  } catch (error) {
    console.error("Attendance punch failed", error);
    return NextResponse.json({ error: "Não foi possível registar a batida. A base de dados pode ainda não estar atualizada." }, { status: 500 });
  }
}
