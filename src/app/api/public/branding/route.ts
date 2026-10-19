import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) {
 const { searchParams } = new URL(request.url);
 const slug = (searchParams.get("slug") || process.env.DEFAULT_ORGANIZATION_SLUG || "empresa-principal").trim().toLowerCase();
 const org=await prisma.organization.findFirst({where:{status:"active",slug},include:{branding:true}});
 return NextResponse.json({companyName:org?.name||"ISP Manager",productName:org?.branding?.systemName||"ISP Manager",logo:org?.branding?.logoUrl||"",primaryColor:org?.branding?.primaryColor||"#4863ed",loginTitle:org?.branding?.welcomeTitle||"Bem-vindo de volta",loginMessage:org?.branding?.welcomeMessage||"Introduz as tuas credenciais para continuar.",supportEmail:org?.branding?.supportEmail||""});
}
