import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
 const session = await getSession();
 if (!session) return NextResponse.json({error:"Sessão necessária."},{status:401});
 if (!(await hasPermission(session,"orders.view"))) return NextResponse.json({error:"Sem permissão."},{status:403});
 const rows = await prisma.auditEvent.findMany({where:{organizationId:session.organizationId,entityType:"ServiceOrder",action:"TECHNICIAN_CHECKLIST"},orderBy:{createdAt:"desc"},take:500,select:{entityId:true,details:true,createdAt:true}});
 type ChecklistRecord = { items?: Record<string, boolean>; notes?: string };
 const checklists:Record<string,{id:string;items:Record<string,boolean>;notes:string;updatedAt:Date}>={};
 for (const row of rows) if(row.entityId && !checklists[row.entityId]) { const d=row.details as ChecklistRecord | null; checklists[row.entityId]={id:row.entityId,items:d?.items||{},notes:d?.notes||"",updatedAt:row.createdAt}; }
 return NextResponse.json({checklists});
}
export async function POST(request:NextRequest) {
 const session = await getSession();
 if (!session) return NextResponse.json({error:"Sessão necessária."},{status:401});
 if (session.role!=="TECHNICIAN" && session.role!=="MANAGER") return NextResponse.json({error:"Apenas técnicos podem guardar checklists."},{status:403});
 try {
  const body=await request.json(); const orderId=String(body.orderId||"");
  const items=body.items && typeof body.items==="object" && !Array.isArray(body.items)?body.items:{};
  const notes=String(body.notes||"").slice(0,3000);
  const order=await prisma.serviceOrder.findFirst({where:{id:orderId,organizationId:session.organizationId},select:{id:true,assignedTeam:true}});
  if(!order) return NextResponse.json({error:"Ordem não encontrada."},{status:404});
  if(session.role==="TECHNICIAN") { const technician=await prisma.technician.findFirst({where:{organizationId:session.organizationId,active:true,email:{equals:session.email,mode:"insensitive"}},include:{team:{select:{name:true}}}}); const assignedNames=[session.name,technician?.team?.name].filter((name): name is string => Boolean(name)); if(!assignedNames.includes(order.assignedTeam||"")) return NextResponse.json({error:"Só podes guardar checklists de ordens atribuídas a ti ou à tua equipa."},{status:403}); }
  const safeItems:Record<string,boolean>={}; for(let i=0;i<6;i++) safeItems[String(i)]=Boolean(items[String(i)]);
  const checklist={id:orderId,items:safeItems,notes,updatedAt:new Date().toISOString()};
  await prisma.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"TECHNICIAN_CHECKLIST",entityType:"ServiceOrder",entityId:orderId,details:{items:safeItems,notes}}});
  return NextResponse.json({checklist},{status:201});
 } catch(error) { console.error("Save technician checklist failed",error); return NextResponse.json({error:"Não foi possível guardar a checklist."},{status:500}); }
}
