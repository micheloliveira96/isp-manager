"use client";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import "./mikrotik.css";

type Row = Record<string, string>;
type Router = { id: string; name: string; online: boolean; enabled: boolean; message: string; lastSeenAt: string | null; snapshotAt: string | null; snapshot: { resource: Row; identity: Row; sessions: Row[]; interfaces: Row[]; users: Row[] } | null };
type Subscriber = { id: string; routerId: string; username: string; planId: string; client: { name: string; status: string }; plan: { name: string }; authStatus: string };
type Job = { id: string; routerId: string; action: string; status: string; createdAt: string; result: { message?: string } | null };
type Data = { routers: Router[]; subscribers: Subscriber[]; jobs: Job[]; clients: { id: string; name: string; number: string }[]; plans: { id: string; name: string; downloadMbps: number; uploadMbps: number }[] };
const labels: Record<string, string> = { PROVISION: "Criar PPPoE", PASSWORD: "Alterar senha", PLAN: "Trocar plano", SUSPEND: "Bloquear", REACTIVATE: "Desbloquear", DISCONNECT: "Desconectar", SYNC_PLAN: "Sincronizar plano", REFRESH: "Testar conexão", PENDING: "Na fila", RUNNING: "Executando", SUCCEEDED: "Confirmado no MikroTik", FAILED: "Recusado", UNKNOWN: "Resultado incerto — conferir", REVIEWED: "Revisado manualmente", EXPIRED: "Expirou sem execução" };
export default function MikrotikPage() {
  const [data, setData] = useState<Data | null>(null), [routerId, setRouterId] = useState("");
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [agentToken, setAgentToken] = useState("");
  const [edit, setEdit] = useState<{ subscriber: Subscriber; action: string } | null>(null);
  const load = useCallback(async () => {
    try { const r = await fetch('/api/mikrotik', { cache: 'no-store' }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j); }
    catch (e) { setData(null); setMessage(e instanceof Error ? e.message : 'Não foi possível consultar a integração.'); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 10000); return () => clearInterval(timer); }, [load]);
  const router = data?.routers.find(r => r.id === routerId) || data?.routers[0];
  async function request(path: string, method: string, value: unknown) {
    setBusy(true); setMessage('');
    try { const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(value) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Falha na operação'); await load(); return j; }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Falha na operação'); return null; }
    finally { setBusy(false); }
  }
  async function queue(action: string, extra: Record<string, unknown> = {}) {
    if (!router) return false;
    const result = await request('/api/mikrotik/jobs', 'POST', { routerId: router.id, action, ...extra });
    if (result) setMessage('Operação na fila. Aguarde “Confirmado no MikroTik” no histórico.');
    return !!result;
  }
  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget;
    const result = await request('/api/mikrotik', 'POST', { name: new FormData(form).get('name') });
    if (result) { setAgentToken(result.agentToken); setRouterId(result.router.id); form.reset(); }
  }
  async function provision(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, b = Object.fromEntries(new FormData(form));
    if (await queue('PROVISION', b)) form.reset();
  }
  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!edit) return; const form = e.currentTarget;
    if (await queue(edit.action, { ...Object.fromEntries(new FormData(form)), subscriberId: edit.subscriber.id })) { form.reset(); setEdit(null); }
  }
  const snapshot = router?.online ? router.snapshot : null;
  return <main className="mt-page">
    <header><div><Link href="/">← ISP Manager</Link><h1>MikroTik</h1><p>PPPoE, planos e autenticação com confirmação no roteador.</p></div><button disabled={busy} onClick={() => void load()}>Atualizar</button></header>
    {message && <p role="status" className="mt-notice">{message}</p>}
    <section className="mt-card"><h2>1. Conectar um roteador</h2><p>Cadastre aqui e execute <strong>CONFIGURAR-AGENTE.cmd</strong> no Windows do laboratório. O agente busca as operações por HTTPS; mantenha o Docker Desktop ligado.</p>
      <form onSubmit={register} className="mt-inline"><label>Nome do roteador<input name="name" placeholder="CHR laboratório" minLength={2} maxLength={80} required /></label><button disabled={busy}>Cadastrar roteador</button></form>
      {agentToken && <div className="mt-notice"><strong>Chave de instalação — exibida uma única vez</strong><p>Use no assistente local. Não é a senha do MikroTik. Não envie pelo chat.</p><input aria-label="Chave de instalação do agente" type="password" readOnly value={agentToken} autoComplete="off" /><button onClick={() => void navigator.clipboard.writeText(agentToken).then(() => setMessage('Chave copiada. Cole no assistente local.'))}>Copiar chave</button> <button onClick={() => setAgentToken('')}>Ocultar e limpar</button></div>}
    </section>
    {router && <>
      <section className="mt-card"><div className="mt-inline"><label>Roteador<select value={router.id} onChange={e => setRouterId(e.target.value)}>{data?.routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button disabled={busy || !router.online} onClick={() => void queue('REFRESH')}>Testar conexão</button><button disabled={busy} onClick={async () => { if (confirm('Renovar a chave? O agente atual precisará ser reconfigurado.')) { const result = await request('/api/mikrotik', 'PATCH', { routerId: router.id, operation: 'rotate' }); if (result) setAgentToken(result.agentToken); } }}>Renovar chave</button><button disabled={busy || !router.enabled} onClick={() => { if (confirm('Desativar comunicação deste agente?')) void request('/api/mikrotik', 'PATCH', { routerId: router.id, operation: 'disable' }); }}>Desativar agente</button></div>
        <p className={router.online ? 'mt-online' : 'mt-offline'}>{router.message}</p><small>Último contato: {router.lastSeenAt ? new Date(router.lastSeenAt).toLocaleString('pt-BR') : 'Nunca conectado'}</small>
        {snapshot && <div className="mt-stats"><div>Identidade<strong>{snapshot.identity.name}</strong></div><div>RouterOS<strong>{snapshot.resource.version}</strong></div><div>CPU<strong>{snapshot.resource['cpu-load']}%</strong></div><div>Sessões reais<strong>{snapshot.sessions.length}</strong></div><div>Uptime<strong>{snapshot.resource.uptime}</strong></div></div>}
      </section>
      <section className="mt-card"><h2>2. Criar usuário PPPoE</h2><p>Associe um cliente e um plano existentes. O plano cria um perfil exclusivo do ISP Manager. Usuários já existentes fora da integração não são sobrescritos.</p>
        <form onSubmit={provision} className="mt-grid"><label>Cliente<select name="clientId" required defaultValue=""><option value="" disabled>Selecione</option>{data?.clients.map(c => <option key={c.id} value={c.id}>{c.number} · {c.name}</option>)}</select></label><label>Plano<select name="planId" required defaultValue=""><option value="" disabled>Selecione</option>{data?.plans.map(p => <option key={p.id} value={p.id}>{p.name} · ↓{p.downloadMbps} / ↑{p.uploadMbps} Mbps</option>)}</select></label><label>Login PPPoE<input name="username" pattern="[A-Za-z0-9._\-]+" maxLength={64} required autoComplete="off" /></label><label>Senha PPPoE<input name="password" type="password" minLength={8} maxLength={64} required autoComplete="new-password" /></label><button disabled={busy || !router.online}>Criar e provisionar</button></form>
      </section>
      <section className="mt-card"><h2>3. Clientes e ações</h2><div className="mt-table"><table><thead><tr><th>Cliente / login</th><th>Plano</th><th>Autenticação real</th><th>Sessão / IP real</th><th>Ações</th></tr></thead><tbody>{data?.subscribers.filter(s => s.routerId === router.id).map(s => {
        const user = snapshot?.users.find(u => u.name === s.username), session = snapshot?.sessions.find(r => r.name === s.username);
        return <tr key={s.id}><td><strong>{s.client.name}</strong><br />{s.username}<br /><small>Financeiro/cadastro: {s.client.status}</small></td><td>{s.plan.name}</td><td>{!snapshot ? 'Sem dados atuais' : !user ? 'Não encontrado no roteador' : user.disabled === 'true' ? 'Bloqueado' : 'Habilitado'}</td><td>{!snapshot ? 'Sem dados atuais' : session ? `Conectado · ${session.address}` : 'Sem sessão ativa'}</td><td className="mt-actions">{['PLAN', 'PASSWORD', 'SUSPEND', 'REACTIVATE', 'DISCONNECT'].map(action => <button key={action} disabled={busy || !router.online} onClick={() => { if (['PLAN', 'PASSWORD'].includes(action)) setEdit({ subscriber: s, action }); else if (confirm(`${labels[action]} ${s.username}?`)) void queue(action, { subscriberId: s.id }); }}>{labels[action]}</button>)}</td></tr>;
      })}</tbody></table></div>
      {edit && <form onSubmit={update} className="mt-inline"><strong>{labels[edit.action]}: {edit.subscriber.username}</strong>{edit.action === 'PASSWORD' ? <label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={64} required /></label> : <label>Novo plano<select name="planId" required>{data?.plans.map(p => <option key={p.id} value={p.id}>{p.name} · ↓{p.downloadMbps} / ↑{p.uploadMbps}</option>)}</select></label>}<button disabled={busy}>Enviar alteração</button><button type="button" onClick={() => setEdit(null)}>Cancelar</button></form>}
      </section>
      <section className="mt-card"><h2>Planos no MikroTik</h2><p>Depois de criar ou alterar um plano no <Link href="/planos">cadastro de planos</Link>, sincronize sua velocidade aqui. Download e upload são enviados na ordem correta do RouterOS.</p><div className="mt-actions">{data?.plans.map(p => <button key={p.id} disabled={busy || !router.online} onClick={() => void queue('SYNC_PLAN', { planId: p.id })}>{p.name} · ↓{p.downloadMbps} / ↑{p.uploadMbps} Mbps — sincronizar</button>)}</div><small>A licença gratuita do CHR limita a vazão; o valor configurado do plano é independente dessa limitação.</small></section>
      <section className="mt-card"><h2>Interfaces reais</h2>{snapshot ? <div className="mt-table"><table><thead><tr><th>Interface</th><th>Estado</th><th>Recebidos (bytes)</th><th>Enviados (bytes)</th></tr></thead><tbody>{snapshot.interfaces.map(i => <tr key={i.name}><td>{i.name}</td><td>{i.running === 'true' ? 'Ativa' : 'Inativa'}</td><td>{i['rx-byte'] ?? 'Não informado'}</td><td>{i['tx-byte'] ?? 'Não informado'}</td></tr>)}</tbody></table></div> : <p>MikroTik indisponível — sem dados de monitoramento.</p>}</section>
      <section className="mt-card"><h2>Histórico de operações</h2><p>Uma solicitação aceita ainda precisa ser confirmada pelo agente. Resultados incertos exigem revisão; nunca são repetidos automaticamente.</p><div className="mt-table"><table><thead><tr><th>Data</th><th>Operação</th><th>Resultado</th></tr></thead><tbody>{data?.jobs.filter(j => j.routerId === router.id).map(j => <tr key={j.id}><td>{new Date(j.createdAt).toLocaleString('pt-BR')}</td><td>{labels[j.action]}</td><td>{labels[j.status] || j.status}{j.status === 'UNKNOWN' && <button disabled={busy} onClick={() => { if (confirm('Você conferiu o usuário e o perfil diretamente no MikroTik e entende que esta ação apenas libera a fila, sem executar nem confirmar a operação?')) void request('/api/mikrotik/jobs', 'PATCH', { jobId: j.id, confirmReviewed: true }); }}>Conferi o roteador; liberar fila</button>}</td></tr>)}</tbody></table></div></section>
    </>}
    <footer>Automação financeira desativada. Bloqueios e desbloqueios exigem uma ação autorizada no painel.</footer>
  </main>;
}
