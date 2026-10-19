import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession, permissionCatalog } from "@/lib/session";
import { prisma } from "@/lib/prisma";
const ROLES = ["MANAGER", "ATTENDANT", "TECHNICIAN"];
const defaults:Record<string,string[]>={MANAGER:permissionCatalog.map(p=>p.code),ATTENDANT:["orders.view","orders.create","orders.update"],TECHNICIAN:["orders.view","orders.update"]};
export async function GET() {
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Sessão necessária."},{status:401});
 if(session.role!=="MANAGER")return NextResponse.json({error:"Apenas o gestor pode gerir utilizadores."},{status:403});
 const raw=await prisma.user.findMany({where:{organizationId:session.organizationId},include:{permissions:true},orderBy:{createdAt:"desc"}});
 const users=raw.map(u=>{const effective=new Map<string, boolean>((defaults[u.role]||[]).map(code=>[code,true] as [string, boolean]));for(const p of u.permissions)effective.set(p.permissionCode,p.allowed);return{id:u.id,name:u.name,email:u.email,role:u.role,active:u.active,createdAt:u.createdAt,permissions:Object.fromEntries(effective)}});
 return NextResponse.json({users,permissionCatalog});
}
export async function POST(request:NextRequest) {
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Sessão necessária."},{status:401});
 if(session.role!=="MANAGER")return NextResponse.json({error:"Apenas o gestor pode criar utilizadores."},{status:403});
 try {
  const body=await request.json();const name=String(body.name||"").trim();const email=String(body.email||"").trim().toLowerCase();const password=String(body.password||"");const role=String(body.role||"ATTENDANT");
  if(name.length<2||name.length>100||!/^\S+@\S+\.\S+$/.test(email)||email.length>200||password.length<12||password.length>200||!ROLES.includes(role))return NextResponse.json({error:"Confirma o nome, email, perfil e uma palavra-passe com pelo menos 12 caracteres."},{status:400});
  const existing=await prisma.user.findFirst({where:{organizationId:session.organizationId,email}});
  if(existing)return NextResponse.json({error:"Já existe um utilizador com este email nesta empresa."},{status:409});
  const user=await prisma.user.create({data:{organizationId:session.organizationId,name,email,passwordHash:await bcrypt.hash(password,12),role,active:true},select:{id:true,name:true,email:true,role:true,active:true,createdAt:true}});
  await prisma.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"CREATE_USER",entityType:"User",entityId:user.id,details:{email:user.email,role:user.role}}});
  return NextResponse.json({user},{status:201});
 }catch(error){console.error("Create user failed",error);return NextResponse.json({error:"Não foi possível criar o utilizador."},{status:500})}
}
export async function PATCH(request:NextRequest) {
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Sessão necessária."},{status:401});
 if(session.role!=="MANAGER")return NextResponse.json({error:"Apenas o gestor pode alterar utilizadores."},{status:403});
 try{
  const body=await request.json();const id=String(body.id||"");
  if(!id)return NextResponse.json({error:"Utilizador inválido."},{status:400});
  const user=await prisma.user.findFirst({where:{id,organizationId:session.organizationId}});
  if(!user)return NextResponse.json({error:"Utilizador não encontrado."},{status:404});
  if(body.permissions && user.role==="MANAGER") return NextResponse.json({error:"Os gestores têm acesso total e não podem ter permissões reduzidas por esta matriz."},{status:400});
  if(body.permissions && typeof body.permissions==="object" && !Array.isArray(body.permissions)){
   const entries=Object.entries(body.permissions as Record<string,unknown>);
   if(entries.some(([code,value])=>!permissionCatalog.some(p=>p.code===code)||typeof value!=="boolean"))return NextResponse.json({error:"Permissões inválidas."},{status:400});
   await prisma.$transaction(entries.map(([permissionCode,allowed])=>prisma.userPermission.upsert({where:{userId_permissionCode:{userId:id,permissionCode}},update:{allowed:allowed as boolean},create:{userId:id,permissionCode,allowed:allowed as boolean}})));
   await prisma.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"UPDATE_PERMISSIONS",entityType:"User",entityId:id,details:{permissions:body.permissions}}});
   return NextResponse.json({ok:true});
  }
  const active=body.active;
  if(typeof active!=="boolean")return NextResponse.json({error:"Dados inválidos."},{status:400});
  if(id===session.userId&&!active)return NextResponse.json({error:"Não podes desativar a tua própria conta."},{status:400});
  const updated=await prisma.user.update({where:{id},data:{active},select:{id:true,name:true,email:true,role:true,active:true,createdAt:true}});
  await prisma.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:active?"ENABLE_USER":"DISABLE_USER",entityType:"User",entityId:id,details:{email:user.email,active}}});
  return NextResponse.json({user:updated});
 }catch(error){console.error("Update user failed",error);return NextResponse.json({error:"Não foi possível alterar o utilizador."},{status:500})}
}
