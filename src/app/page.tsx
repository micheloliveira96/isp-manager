import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, CheckCircle2, ChevronDown, CircleHelp, ClipboardList, Clock3, HardHat, LayoutDashboard, MapPin, Package, Plus, Search, Settings2, ShieldCheck, Truck, Users, Wifi, Wrench, Zap } from "lucide-react";

const stats = [
  { label: "Ordens abertas", value: "24", note: "6 com prioridade alta", icon: ClipboardList, tone: "blue", trend: "+8,3%", up: true },
  { label: "Equipas em campo", value: "08", note: "de 10 equipas disponíveis", icon: HardHat, tone: "green", trend: "+2 hoje", up: true },
  { label: "Em análise", value: "07", note: "Aguardam validação", icon: ShieldCheck, tone: "violet", trend: "3 urgentes", up: false },
  { label: "Stock baixo", value: "03", note: "Itens precisam de reposição", icon: Package, tone: "amber", trend: "Ver stock", up: false },
];
const jobs = [
  { id: "OS-2026-0148", title: "Instalação FTTH", client: "Residencial Aurora", place: "Setor Norte", team: "Equipa Alfa", time: "09:00", status: "Em execução", color: "blue" },
  { id: "OS-2026-0147", title: "Falha de ligação", client: "Mercado São Lucas", place: "Centro", team: "Equipa Bravo", time: "09:30", status: "Prioridade alta", color: "red" },
  { id: "OS-2026-0146", title: "Manutenção preventiva", client: "Condomínio das Flores", place: "Setor Sul", team: "Equipa Charlie", time: "10:00", status: "Agendada", color: "violet" },
  { id: "OS-2026-0145", title: "Substituição de ONT", client: "Clínica Horizonte", place: "Centro", team: "Equipa Delta", time: "10:30", status: "Aguardando equipa", color: "amber" },
];
const activities = [
  { initials: "LM", name: "Luiza Martins", action: "criou a ordem", target: "OS-2026-0148", time: "há 8 min", color: "lavender" },
  { initials: "RC", name: "Rui Costa", action: "enviou para análise", target: "OS-2026-0142", time: "há 24 min", color: "mint" },
  { initials: "AF", name: "Ana Ferreira", action: "registou saída de stock", target: "Cabo drop 1F", time: "há 41 min", color: "peach" },
];
const navGroups = [
  { heading: "VISÃO GERAL", items: [{ label: "Painel inicial", icon: LayoutDashboard, active: true }, { label: "Calendário operacional", icon: CalendarDays }, { label: "Ordens de serviço", icon: ClipboardList, badge: "24" }] },
  { heading: "OPERAÇÃO", items: [{ label: "Clientes e instalações", icon: Users }, { label: "Equipas e técnicos", icon: HardHat }, { label: "Frota", icon: Truck }, { label: "Equipamentos", icon: Wifi }, { label: "Stock e armazém", icon: Package }] },
  { heading: "CONTROLO", items: [{ label: "Análise de serviços", icon: ShieldCheck, badge: "7" }, { label: "Ponto e presenças", icon: Clock3 }, { label: "Relatórios", icon: Activity }] },
];
export default function Home() {
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Wifi size={21} strokeWidth={2.6}/></div><div><strong>isp<span>manager</span></strong><small>GESTÃO OPERACIONAL</small></div></div>
      <div className="company-switch"><div className="company-symbol">N</div><div className="company-copy"><strong>Netvia Telecom</strong><span>Ambiente de demonstração</span></div><ChevronDown size={15}/></div>
      <nav className="navigation">{navGroups.map(group => <div className="nav-group" key={group.heading}><p className="nav-heading">{group.heading}</p>{group.items.map(item => {const Icon=item.icon;return <a key={item.label} href="#" className={`nav-item ${item.active?"active":""}`}><Icon size={18}/><span>{item.label}</span>{item.badge&&<b>{item.badge}</b>}</a>})}</div>)}</nav>
      <div className="sidebar-bottom"><a className="nav-item" href="/configuracoes/identidade"><Settings2 size={18}/><span>Configurações</span></a><a className="nav-item" href="#"><CircleHelp size={18}/><span>Ajuda e suporte</span></a>
        <div className="plan-card"><div className="plan-icon"><Zap size={16}/></div><strong>Operação sob controlo</strong><p>Centralize equipas, serviços e recursos num só lugar.</p><button>Conhecer módulos <ArrowRight size={14}/></button></div>
        <div className="profile"><div className="avatar avatar-indigo">MC</div><div className="profile-copy"><strong>Gestor de sistema</strong><span>Administrador · Demonstração</span></div><ChevronDown size={16}/></div>
      </div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Netvia Telecom</span><span className="crumb-slash">/</span><strong>Painel inicial</strong></div><div className="top-actions"><div className="searchbox"><Search size={16}/><span>Pesquisar...</span><kbd>⌘ K</kbd></div><button className="icon-button notification" aria-label="Notificações"><Bell size={18}/><i/></button><div className="top-avatar">MC</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> SEGUNDA-FEIRA, 19 DE OUTUBRO</div><h1>Bom dia, Gestor <span>👋</span></h1><p className="subtitle">Aqui está o resumo da operação da sua equipa.</p></div><button className="primary-button"><Plus size={17}/> Nova ordem de serviço</button></div>
        <div className="demo-banner"><div className="demo-banner-icon"><ShieldCheck size={18}/></div><div><strong>Ambiente de demonstração</strong><span>Dados ilustrativos. Autenticação e operações reais ainda não estão ativadas.</span></div><span className="demo-pill">DEMO</span></div>
        <div className="section-title-row"><div><h2>Resumo da operação</h2><p>Acompanhe os principais indicadores do dia.</p></div><button className="date-filter"><CalendarDays size={16}/> Hoje <ChevronDown size={14}/></button></div>
        <div className="stats-grid">{stats.map(s=>{const Icon=s.icon;return <article className="stat-card" key={s.label}><div className="stat-top"><span>{s.label}</span><div className={`stat-icon ${s.tone}`}><Icon size={18}/></div></div><div className="stat-value">{s.value}</div><div className="stat-foot"><span>{s.note}</span><b className={s.up?"trend-up":"trend-neutral"}>{s.up?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>} {s.trend}</b></div></article>})}</div>
        <div className="dashboard-grid">
          <section className="panel orders-panel"><div className="panel-header"><div><h2>Ordens de serviço</h2><p>Estado das intervenções planeadas para hoje.</p></div><button className="text-button">Ver todas <ArrowRight size={15}/></button></div><div className="table-wrap"><table><thead><tr><th>ORDEM / CLIENTE</th><th>EQUIPA</th><th>HORÁRIO</th><th>ESTADO</th><th></th></tr></thead><tbody>{jobs.map(job=><tr key={job.id}><td><div className="job-title">{job.title}</div><div className="job-meta">{job.id} <span>·</span> {job.client}</div><div className="job-place"><MapPin size={12}/>{job.place}</div></td><td><div className="team-cell"><div className="team-avatar">{job.team.split(" ")[1][0]}</div>{job.team}</div></td><td><div className="time-cell"><Clock3 size={14}/>{job.time}</div></td><td><span className={`status status-${job.color}`}><i/>{job.status}</span></td><td><button className="more-button" aria-label={`Mais opções ${job.id}`}>···</button></td></tr>)}</tbody></table></div><div className="panel-footer"><span>A mostrar 4 de 24 ordens abertas</span><button>Ver central de ordens <ArrowRight size={14}/></button></div></section>
          <section className="panel activity-panel"><div className="panel-header"><div><h2>Atividade recente</h2><p>Últimas ações da demonstração.</p></div><button className="dots-button">···</button></div><div className="activity-list">{activities.map((a,i)=><div className="activity-item" key={a.name}><div className={`avatar activity-avatar ${a.color}`}>{a.initials}</div><div className="activity-copy"><p><strong>{a.name}</strong> {a.action}</p><b>{a.target}</b><span>{a.time}</span></div><div className={`activity-marker marker-${i}`}><CheckCircle2 size={15}/></div></div>)}</div><div className="activity-note"><ShieldCheck size={16}/><span>O histórico de auditoria real será implementado na próxima etapa.</span></div></section>
        </div>
        <div className="bottom-grid">
          <section className="panel schedule-panel"><div className="panel-header"><div><h2>Agenda das equipas</h2><p>Planeamento rápido das próximas intervenções.</p></div><button className="text-button">Abrir calendário <ArrowRight size={15}/></button></div><div className="schedule-list"><div className="schedule-row"><div className="schedule-time">09:00<span>09:45</span></div><div className="schedule-line blue-line"/><div className="schedule-description"><strong>Instalação FTTH</strong><span>Equipa Alfa · Setor Norte</span></div><span className="schedule-label label-blue">Em curso</span></div><div className="schedule-row"><div className="schedule-time">09:30<span>10:15</span></div><div className="schedule-line red-line"/><div className="schedule-description"><strong>Falha de ligação</strong><span>Equipa Bravo · Centro</span></div><span className="schedule-label label-red">Urgente</span></div><div className="schedule-row"><div className="schedule-time">10:00<span>11:00</span></div><div className="schedule-line violet-line"/><div className="schedule-description"><strong>Manutenção preventiva</strong><span>Equipa Charlie · Setor Sul</span></div><span className="schedule-label label-violet">Agendada</span></div></div></section>
          <section className="panel resource-panel"><div className="panel-header"><div><h2>Recursos operacionais</h2><p>Disponibilidade nesta demonstração.</p></div><button className="dots-button">···</button></div><div className="resource-row"><div className="resource-icon green"><HardHat size={17}/></div><div className="resource-copy"><strong>Equipas disponíveis</strong><span>Prontas para atribuição</span></div><b>8 <small>/ 10</small></b></div><div className="resource-row"><div className="resource-icon blue"><Truck size={17}/></div><div className="resource-copy"><strong>Viaturas operacionais</strong><span>2 em manutenção</span></div><b>6 <small>/ 8</small></b></div><div className="resource-row"><div className="resource-icon amber"><Wrench size={17}/></div><div className="resource-copy"><strong>Materiais em alerta</strong><span>Repor stock mínimo</span></div><b className="warning-number">3 <small>itens</small></b></div><div className="resource-progress"><div><span>Capacidade diária planeada</span><strong>72%</strong></div><div className="progress-track"><span/></div></div></section>
        </div>
        <footer className="footer"><span>ISP Manager <b>·</b> versão inicial 0.1.0</span><span><i className="footer-dot"/> Ambiente local de demonstração <b>·</b> Em desenvolvimento</span></footer>
      </div>
    </section>
  </main>;
}
