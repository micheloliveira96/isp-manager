"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Wifi, ShieldCheck, LoaderCircle } from "lucide-react";
import "./login.css";

export default function LoginForm() {
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  async function submit(e:FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
      const data = await response.json();
      if(!response.ok) throw new Error(data.error || "Não foi possível iniciar sessão.");
      router.replace("/"); router.refresh();
    } catch(err) { setError(err instanceof Error ? err.message : "Erro ao iniciar sessão."); }
    finally { setLoading(false); }
  }
  return <main className="login-page"><section className="login-aside"><div className="login-brand"><div><Wifi size={25}/></div><strong>ISP<span>Manager</span></strong></div><div className="login-aside-content"><span className="login-kicker">GESTÃO OPERACIONAL</span><h1>Toda a operação.<br/><em>Num só lugar.</em></h1><p>Ordens de serviço, equipas, equipamentos e recursos — organizados numa plataforma preparada para o teu negócio.</p><div className="login-benefits"><span><ShieldCheck size={17}/> Acessos controlados por perfil</span><span><ShieldCheck size={17}/> Dados separados por empresa</span><span><ShieldCheck size={17}/> Identidade visual personalizável</span></div></div><div className="login-aside-footer">ISP Manager · Plataforma de gestão para provedores</div></section><section className="login-main"><div className="login-form-wrap"><div className="login-mobile-brand"><div><Wifi size={22}/></div><strong>ISP<span>Manager</span></strong></div><div className="login-form-heading"><span>ÁREA DE ACESSO</span><h2>Bem-vindo de volta</h2><p>Introduz as tuas credenciais para continuar.</p></div><form onSubmit={submit}><label htmlFor="email">Email profissional</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@empresa.pt"/><div className="login-password-label"><label htmlFor="password">Palavra-passe</label></div><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Introduz a tua palavra-passe"/>{error&&<div className="login-error" role="alert">{error}</div>}<button disabled={loading} type="submit">{loading?<><LoaderCircle className="spin" size={17}/> A validar...</>:"Iniciar sessão"}</button></form><div className="login-security-note"><ShieldCheck size={16}/><span>Acesso protegido. Se não tens uma conta, contacta o gestor da tua empresa.</span></div></div><footer>© {new Date().getFullYear()} ISP Manager · Todos os direitos reservados</footer></section></main>;
}
