import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession, permissionCatalog } from "@/lib/session";
import { prisma } from "@/lib/prisma";
const ROLES = ["MANAGER", "ATTENDANT", "TECHNICIAN"];
const defaults:Record<string,string[]>={MANAGER:permissionCatalog.map(p=>p.code),ATTENDANT:["orders.view","orders.create","orders.update"],TECHNICIAN:["orders.view","orders.update"]};
export async function GET() {
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Sessão necessária."},{status:401});
 if(session.role!=="MANAGER")return NextResponse.json({error:"Apenas o administrador pode gerenciar usuários."},{status:403});
 const raw=await prisma.user.findMany({where:{organizationId:session.organizationId},include:{permissions:true},orderBy:{createdAt:"desc"}});
 const users=raw.map(u=>{const effective=new Map<string, boolean>((defaults[u.role]||[]).map(code=>[code,true] as [string, boolean]));for(const p of u.permissions)effective.set(p.permissionCode,p.allowed);return{id:u.id,name:u.name,email:u.email,role:u.role,active:u.active,createdAt:u.createdAt,permissions:Object.fromEntries(effective)}});
 return NextResponse.json({users,permissionCatalog});
}
export async function POST(request:NextRequest) {
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Sessão necessária."},{status:401});
 if(session.role!=="MANAGER")return NextResponse.json({error:"Apenas o administrador pode criar usuários."},{status:403});
 try {
  const body=await request.json();const name=String(body.name||"").trim();const email=String(body.email||"").trim().toLowerCase();const password=String(body.password||"");const role=String(body.role||"ATTENDANT");
  if(name.length<2||name.length>100||!/^\S+@\S+\.\S+$/.test(email)||email.length>200||password.length<12||password.length>200||!ROLES.includes(role))return NextResponse.json({error:"Confirma o nome, email, perfil e uma senha com pelo menos 12 caracteres."},{status:400});
  const existing=await prisma.user.findFirst({where:{organizationId:session.organizationId,email}});
  if(existing)return NextResponse.json({error:"Já existe um usuário com este email nesta empresa."},{status:409});
  const user=await prisma.user.create({data:{organizationId:session.organizationId,name,email,passwordHash:await bcrypt.hash(password,12),role,active:true},select:{id:true,name:true,email:true,role:true,active:true,createdAt:true}});
  await prisma.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"CREATE_USER",entityType:"User",entityId:user.id,details:{email:user.email,role:user.role}}});
  return NextResponse.json({user},{status:201});
 }catch(error){console.error("Create user failed",error);return NextResponse.json({error:"Não foi possível criar o usuário."},{status:500})}
}
export async function PATCH(request:NextRequest) {
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Sessão necessária."},{status:401});
 if(session.role!=="MANAGER")return NextResponse.json({error:"Apenas o administrador pode alterar usuários."},{status:403});
 try{
  const body=await request.json();const id=String(body.id||"");
  if(!id)return NextResponse.json({error:"Usuário inválido."},{status:400});
  const user=await prisma.user.findFirst({where:{id,organizationId:session.organizationId}});
  if(!user)return NextResponse.json({error:"Usuário não encontrado."},{status:404});
  if(body.permissions && user.role==="MANAGER") return NextResponse.json({error:"Os gestores têm acesso total e não podem ter permissões reduzidas por esta matriz."},{status:400});
  if(body.permissions && typeof body.permissions==="object" && !Array.isArray(body.permissions)){
   const entries=Object.entries(body.permissions as Record<string,unknown>);
   if(entries.some(([code,value])=>!permissionCatalog.some(p=>p.code===code)||typeof value!=="boolean"))return NextResponse.json({error:"Permissões inválidas."},{status:400});
   await prisma.$transaction(async tx=>{
    for(const [permissionCode,allowed] of entries){
     await tx.userPermission.upsert({where:{userId_permissionCode:{userId:id,permissionCode}},update:{allowed:allowed as boolean},create:{userId:id,permissionCode,allowed:allowed as boolean}});
    }
    await tx.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"UPDATE_PERMISSIONS",entityType:"User",entityId:id,details:{permissions:body.permissions}}});
   });
   return NextResponse.json({ok:true});
  }
  const hasProfileFields=["name","email","role"].some(k=>Object.prototype.hasOwnProperty.call(body,k));
  if(hasProfileFields){
   const name=String(body.name??user.name).trim();const email=String(body.email??user.email).trim().toLowerCase();const role=String(body.role??user.role);
   if(name.length<2||name.length>100||!/^\S+@\S+\.\S+$/.test(email)||email.length>200||!ROLES.includes(role))return NextResponse.json({error:"Confirma o nome, email e perfil."},{status:400});
   if(id===session.userId&&role!=="MANAGER")return NextResponse.json({error:"Não pode retirar o perfil de administrador da sua própria conta."},{status:400});
   const duplicate=await prisma.user.findFirst({where:{organizationId:session.organizationId,email,NOT:{id}}});
   if(duplicate)return NextResponse.json({error:"Já existe um usuário com este email nesta empresa."},{status:409});
   if(user.active&&user.role==="MANAGER"&&role!=="MANAGER"){
    const activeManagers=await prisma.user.count({where:{organizationId:session.organizationId,role:"MANAGER",active:true}});
    if(activeManagers<=1)return NextResponse.json({error:"A empresa tem de manter pelo menos um administrador ativo."},{status:400});
   }
   const updated=await prisma.$transaction(async tx=>{
    const changed=await tx.user.update({where:{id},data:{name,email,role},select:{id:true,name:true,email:true,role:true,active:true,createdAt:true}});
    await tx.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"UPDATE_USER",entityType:"User",entityId:id,details:{before:{name:user.name,email:user.email,role:user.role},after:{name:changed.name,email:changed.email,role:changed.role}}}});
    return changed;
   });
   return NextResponse.json({user:updated});
  }
  const active=body.active;
  if(typeof active!=="boolean")return NextResponse.json({error:"Dados inválidos."},{status:400});
  if(id===session.userId&&!active)return NextResponse.json({error:"Não pode desativar a sua própria conta."},{status:400});
  if(user.active&&user.role==="MANAGER"&&!active){
   const activeManagers=await prisma.user.count({where:{organizationId:session.organizationId,role:"MANAGER",active:true}});
   if(activeManagers<=1)return NextResponse.json({error:"Não é possível desativar o único administrador ativo da empresa."},{status:400});
  }
  const updated=await prisma.$transaction(async tx=>{
   const changed=await tx.user.update({where:{id},data:{active},select:{id:true,name:true,email:true,role:true,active:true,createdAt:true}});
   await tx.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:active?"ENABLE_USER":"DISABLE_USER",entityType:"User",entityId:id,details:{email:user.email,active}}});
   return changed;
  });
  return NextResponse.json({user:updated});
 }catch(error){console.error("Update user failed",error);return NextResponse.json({error:"Não foi possível alterar o usuário."},{status:500})}
}
export async function DELETE(request:NextRequest) {
 const session=await getSession();
 if(!session)return NextResponse.json({error:"Sessão necessária."},{status:401});
 if(session.role!=="MANAGER")return NextResponse.json({error:"Apenas o administrador pode eliminar usuários."},{status:403});
 try{
  const id=request.nextUrl.searchParams.get("id")||String((await request.json().catch(()=>({}))).id||"");
  if(!id)return NextResponse.json({error:"Usuário inválido."},{status:400});
  if(id===session.userId)return NextResponse.json({error:"Não pode eliminar a sua própria conta."},{status:400});
  const user=await prisma.user.findFirst({where:{id,organizationId:session.organizationId}});
  if(!user)return NextResponse.json({error:"Usuário não encontrado."},{status:404});
  if(user.role==="MANAGER"){
   const managers=await prisma.user.count({where:{organizationId:session.organizationId,role:"MANAGER",active:true}});
   if(user.active&&managers<=1)return NextResponse.json({error:"Não é possível eliminar o único administrador ativo da empresa."},{status:400});
  }
  await prisma.$transaction(async tx=>{
   await tx.user.update({where:{id},data:{active:false}});
   await tx.auditEvent.create({data:{organizationId:session.organizationId,actorUserId:session.userId,action:"ARCHIVE_USER",entityType:"User",entityId:id,details:{name:user.name,email:user.email,role:user.role}}});
  });
  return NextResponse.json({ok:true,id});
 }catch(error){console.error("Delete user failed",error);return NextResponse.json({error:"Não foi possível eliminar o usuário."},{status:500})}
}
