import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession, hasPermission } from "@/lib/session";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import LogoutButton from "../components/LogoutButton";
import "./audit.css";
export const dynamic="force-dynamic";
export default async function AuditPage(){
 const session=await getSession();
 if(!session||!(await hasPermission(session,"audit.view")))return <main className="audit-denied"><ShieldCheck size={28}/><h1>Acesso restrito</h1><p>O histórico de auditoria só está disponível para o gestor.</p><Link href="/">Voltar ao painel</Link></main>;
 const events=await prisma.auditEvent.findMany({where:{organizationId:session.organizationId},include:{actor:{select:{name:true,email:true}}},orderBy:{createdAt:"desc"},take:300});
 return <main className="audit-page"><header><Link href="/"><ArrowLeft size={16}/> Painel inicial</Link><span>Histórico de auditoria <LogoutButton/></span></header><div className="audit-content"><small>ADMINISTRAÇÃO / SEGURANÇA</small><h1>Histórico de auditoria</h1><p>Registo cronológico de ações efetuadas nesta empresa.</p><section><div className="audit-summary"><ShieldCheck size={20}/><span><b>{events.length} eventos</b><small>Os utilizadores comuns não podem alterar este histórico através da aplicação.</small></span></div>{events.length===0?<div className="audit-empty">Ainda não existem eventos registados.</div>:<div className="audit-table-wrap"><table><thead><tr><th>DATA / HORA</th><th>UTILIZADOR</th><th>AÇÃO</th><th>OBJETO</th><th>DETALHES</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{new Intl.DateTimeFormat("pt-PT",{dateStyle:"short",timeStyle:"short"}).format(e.createdAt)}</td><td><b>{e.actor?.name||"Sistema"}</b><small>{e.actor?.email||""}</small></td><td>{e.action.replaceAll("_"," ")}</td><td>{e.entityType}<small>{e.entityId||"—"}</small></td><td>{e.details?JSON.stringify(e.details):"—"}</td></tr>)}</tbody></table></div>}</section></div></main>
}
