import {NextRequest,NextResponse} from "next/server";
import {getSession} from "@/lib/session";
import {prisma} from "@/lib/prisma";
export async function POST(request:NextRequest){
 const s=await getSession();if(!s)return NextResponse.json({error:"Sessão necessária."},{status:401});
 if(s.role!=="TECHNICIAN")return NextResponse.json({error:"Área exclusiva para técnicos."},{status:403});
 try{
  const b=await request.json(),technician=await prisma.technician.findFirst({where:{organizationId:s.organizationId,userId:s.userId,active:true},select:{id:true}});
  if(!technician)return NextResponse.json({error:"Cadastro de técnico não associado."},{status:403});
  const kind=String(b.kind||"");if(!["MATERIAL","VEHICLE","SERVICE"].includes(kind))return NextResponse.json({error:"Tipo de checklist inválido."},{status:400});
  const orderId=String(b.orderId||"")||null,vehicleId=String(b.vehicleId||"")||null;
  if(orderId&&!await prisma.serviceOrder.findFirst({where:{id:orderId,organizationId:s.organizationId,assignedTechnicianId:technician.id}}))return NextResponse.json({error:"Ordem não atribuída a este técnico."},{status:403});
  if(vehicleId&&!await prisma.fleetVehicle.findFirst({where:{id:vehicleId,organizationId:s.organizationId,driverTechnicianId:technician.id}}))return NextResponse.json({error:"Veículo não atribuído a este técnico."},{status:403});
  const items=Array.isArray(b.items)?b.items.slice(0,100).map((x: any)=>({label:String(x.label||"").slice(0,120),checked:Boolean(x.checked),quantity:Number.isFinite(Number(x.quantity))?Math.max(0,Math.min(100000,Number(x.quantity))):0})): [];
  const notes=String(b.notes||"").slice(0,2000);
  const event=await prisma.auditEvent.create({data:{organizationId:s.organizationId,actorUserId:s.userId,action:"TECHNICIAN_CHECKLIST",entityType:kind,entityId:orderId||vehicleId||technician.id,details:{kind,technicianId:technician.id,orderId,vehicleId,items,notes,createdAt:new Date().toISOString()}}});
  if(kind==="SERVICE"&&orderId){const status=String(b.status||"IN_PROGRESS");if(!["IN_PROGRESS","REVIEW"].includes(status))return NextResponse.json({error:"Estado de atendimento inválido."},{status:400});await prisma.serviceOrder.update({where:{id:orderId},data:{status}})}
  return NextResponse.json({success:true,id:event.id},{status:201});
 }catch(e){console.error("Checklist save failed",e);return NextResponse.json({error:"Não foi possível guardar o checklist."},{status:500})}
}
