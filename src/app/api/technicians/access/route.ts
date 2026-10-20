import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
export async function POST(request:NextRequest){
 const session=await getSession(); if(!session)return NextResponse.json({error:"Sessão necessária."},{status:401});
 if(session.role!=="MANAGER")return NextResponse.json({error:"Apenas o administrador pode criar acessos."},{status:403});
 try{
  const b=await request.json(), technicianId=String(b.technicianId||""), email=String(b.email||"").trim().toLowerCase(), password=String(b.password||"");
  if(!technicianId||!/^\S+@\S+\.\S+$/.test(email)||password.length<12||password.length>200)return NextResponse.json({error:"Indica um técnico, email válido e senha com pelo menos 12 caracteres."},{status:400});
  const technician=await prisma.technician.findFirst({where:{id:technicianId,organizationId:session.organizationId,active:true}});
  if(!technician)return NextResponse.json({error:"Técnico não encontrado."},{status:404});
  if(technician.userId)return NextResponse.json({error:"Este técnico já tem acesso associado."},{status:409});
  if(await prisma.user.findFirst({where:{organizationId:session.organizationId,email}}))return NextResponse.json({error:"Este email já está em uso."},{status:409});
  const user=await prisma.user.create({data:{organizationId:session.organizationId,name:technician.name,email,passwordHash:await bcrypt.hash(password,12),role:"TECHNICIAN",active:true,mustChangePassword:true}});
  await prisma.technician.update({where:{id:technician.id},data:{userId:user.id,email}});
  await prisma.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"CREATE_TECHNICIAN_ACCESS",entityType:"Technician",entityId:technician.id,details:{userId:user.id,email}}});
  return NextResponse.json({success:true,technician:{id:technician.id,name:technician.name,email}},{status:201});
 }catch(e){console.error("Create technician access failed",e);return NextResponse.json({error:"Não foi possível criar o acesso."},{status:500})}
}
