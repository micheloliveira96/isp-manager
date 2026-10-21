import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({error:"Sessão necessária."},{status:401});
  try {
    const rows = await prisma.auditEvent.findMany({
      where:{organizationId:session.organizationId,action:"ATTENDANCE_ABSENCE_REQUEST",entityType:"AttendanceAbsence",...(session.role==="MANAGER"?{}:{actorUserId:session.userId})},
      orderBy:{createdAt:"desc"},take:200,include:{actor:{select:{name:true,email:true}}}
    });
    return NextResponse.json({absences:rows.map(r=>({id:r.id,userId:r.actorUserId,name:r.actor?.name||"Utilizador",email:r.actor?.email||"",createdAt:r.createdAt,details:r.details}))});
  } catch(e) { console.error(e); return NextResponse.json({error:"Não foi possível carregar os pedidos."},{status:500}); }
}

export async function POST(request:NextRequest) {
  const session=await getSession();
  if(!session) return NextResponse.json({error:"Sessão necessária."},{status:401});
  if(session.role!=="TECHNICIAN"&&session.role!=="MANAGER") return NextResponse.json({error:"Só os técnicos podem pedir justificação."},{status:403});
  try {
    const body=await request.json();
    const date=String(body.date||"");
    const reason=String(body.reason||"").trim().slice(0,1500);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!reason) return NextResponse.json({error:"Indica a data da falta e a justificação."},{status:400});
    const parsed=new Date(date+"T12:00:00");
    if(Number.isNaN(parsed.getTime())) return NextResponse.json({error:"Data inválida."},{status:400});
    const details={date,reason,status:"PENDING",decisionNote:""};
    const row=await prisma.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"ATTENDANCE_ABSENCE_REQUEST",entityType:"AttendanceAbsence",entityId:date,details}});
    return NextResponse.json({message:"Pedido enviado para análise do responsável.",id:row.id},{status:201});
  } catch(e) { console.error(e); return NextResponse.json({error:"Não foi possível enviar o pedido."},{status:500}); }
}

export async function PATCH(request:NextRequest) {
  const session=await getSession();
  if(!session) return NextResponse.json({error:"Sessão necessária."},{status:401});
  if(session.role!=="MANAGER") return NextResponse.json({error:"Só o responsável pode analisar justificações."},{status:403});
  try {
    const body=await request.json(); const id=String(body.id||""); const status=String(body.status||"");
    if(!id||!["JUSTIFIED","UNJUSTIFIED","REJECTED"].includes(status)) return NextResponse.json({error:"Decisão inválida."},{status:400});
    const existing=await prisma.auditEvent.findFirst({where:{id,organizationId:session.organizationId,action:"ATTENDANCE_ABSENCE_REQUEST",entityType:"AttendanceAbsence"}});
    if(!existing) return NextResponse.json({error:"Pedido não encontrado."},{status:404});
    const old=existing.details && typeof existing.details==="object"&&!Array.isArray(existing.details)?existing.details as Record<string,unknown>:{};
    const details={...old,status,decisionNote:String(body.decisionNote||"").slice(0,1000),decidedBy:session.userId,decidedAt:new Date().toISOString()};
    await prisma.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"ATTENDANCE_ABSENCE_DECISION",entityType:"AttendanceAbsence",entityId:id,details:{requestId:id,...details}}});
    await prisma.auditEvent.update({where:{id},data:{details}});
    return NextResponse.json({message:"Pedido atualizado."});
  } catch(e) { console.error(e); return NextResponse.json({error:"Não foi possível atualizar o pedido."},{status:500}); }
}
