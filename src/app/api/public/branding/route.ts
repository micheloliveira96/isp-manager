import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET() {
 const org=await prisma.organization.findFirst({where:{status:"active"},include:{branding:true},orderBy:{createdAt:"asc"}});
 return NextResponse.json({companyName:org?.name||"ISP Manager",productName:org?.branding?.systemName||"ISP Manager",logo:org?.branding?.logoUrl||"",primaryColor:org?.branding?.primaryColor||"#4863ed",loginTitle:org?.branding?.welcomeTitle||"Bem-vindo de volta",loginMessage:org?.branding?.welcomeMessage||"Introduz as tuas credenciais para continuar.",supportEmail:org?.branding?.supportEmail||""});
}
