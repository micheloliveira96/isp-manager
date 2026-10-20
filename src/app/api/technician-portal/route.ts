import {NextResponse} from "next/server";
import {getSession} from "@/lib/session";
import {prisma} from "@/lib/prisma";
export const dynamic="force-dynamic";
export async function GET(){
 const s=await getSession();if(!s)return NextResponse.json({error:"Inicia sessão para continuar."},{status:401});
 if(s.role!=="TECHNICIAN")return NextResponse.json({error:"Esta área é exclusiva para técnicos."},{status:403});
 const technician=await prisma.technician.findFirst({where:{organizationId:s.organizationId,userId:s.userId,active:true},select:{id:true,name:true,phone:true,team:{select:{name:true}},drivenVehicles:{where:{status:"ACTIVE"},select:{id:true,plate:true,model:true,odometerKm:true,status:true}}}});
 if(!technician)return NextResponse.json({error:"O utilizador ainda não está associado a um cadastro de técnico."},{status:403});
 const [orders,history]=await Promise.all([
  prisma.serviceOrder.findMany({where:{organizationId:s.organizationId,assignedTechnicianId:technician.id},select:{id:true,code:true,title:true,customerName:true,phone:true,address:true,description:true,priority:true,status:true,scheduledAt:true,completedAt:true,createdAt:true},orderBy:[{scheduledAt:"asc"},{createdAt:"desc"}],take:200}),
  prisma.auditEvent.findMany({where:{organizationId:s.organizationId,actorUserId:s.userId,action:"TECHNICIAN_CHECKLIST"},orderBy:{createdAt:"desc"},take:100,select:{id:true,entityType:true,entityId:true,details:true,createdAt:true}})
 ]);
 return NextResponse.json({technician,orders,history});
}
