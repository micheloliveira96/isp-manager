import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
 const session = await getSession();
 if (!session) return NextResponse.json({error:"Faça login para continuar."},{status:401});
 const q=(request.nextUrl.searchParams.get("q")||"").trim();
 const clients=await prisma.client.findMany({where:{organizationId:session.organizationId,...(q?{OR:[{name:{contains:q,mode:"insensitive"}},{number:{contains:q,mode:"insensitive"}},{phone:{contains:q}},{email:{contains:q,mode:"insensitive"}},{taxNumber:{contains:q}}]}:{})},include:{plan:{select:{id:true,name:true,downloadMbps:true,uploadMbps:true}},invoices:{orderBy:{dueDate:"desc"},take:3,select:{id:true,period:true,amount:true,dueDate:true,status:true,paidAt:true}}},orderBy:{name:"asc"},take:200});
 return NextResponse.json({clients});
}
export async function POST(request: NextRequest) {
 const session=await getSession();
 if(!session) return NextResponse.json({error:"Faça login para continuar."},{status:401});
 if(session.role!=="MANAGER") return NextResponse.json({error:"Apenas administradores podem gerir clientes."},{status:403});
 try {
  const b=await request.json(); const name=String(b.name||"").trim(); const phone=String(b.phone||"").trim();
  if(name.length<2||!phone) return NextResponse.json({error:"Nome e telefone são obrigatórios."},{status:400});
  const dueDay=Number(b.dueDay||10); if(!Number.isInteger(dueDay)||dueDay<1||dueDay>28) return NextResponse.json({error:"O vencimento deve ser entre os dias 1 e 28."},{status:400});
  const planId=String(b.planId||"")||null;
  let price=Number(b.monthlyPrice);
  if(planId){const plan=await prisma.internetPlan.findFirst({where:{id:planId,organizationId:session.organizationId,active:true}});if(!plan)return NextResponse.json({error:"Plano inválido ou inativo."},{status:400});if(!Number.isFinite(price)||price<=0)price=Number(plan.monthlyPrice);}
  if(!Number.isFinite(price)||price<0) return NextResponse.json({error:"Indique um valor mensal válido."},{status:400});
  const number=String(b.number||"").trim()||"CL-"+Date.now().toString().slice(-9);
  const client=await prisma.client.create({data:{organizationId:session.organizationId,number,name,taxNumber:String(b.taxNumber||"").trim()||null,address:String(b.address||"").trim()||null,postalCode:String(b.postalCode||"").trim()||null,locality:String(b.locality||"").trim()||null,phone,alternatePhone:String(b.alternatePhone||"").trim()||null,email:String(b.email||"").trim()||null,planId,monthlyPrice:price,dueDay,installDate:b.installDate?new Date(b.installDate):null,status:["ACTIVE","SUSPENDED","CANCELLED"].includes(b.status)?b.status:"ACTIVE",notes:String(b.notes||"").trim()||null}});
  await prisma.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"CREATE",entityType:"Client",entityId:client.id,details:{name,number}}});
  return NextResponse.json({client},{status:201});
 }catch(e){console.error("client create failed",e);return NextResponse.json({error:"Não foi possível guardar o cliente. Verifique se a migração da base de dados foi aplicada."},{status:500});}
}
