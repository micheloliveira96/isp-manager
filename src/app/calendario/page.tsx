"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3, ListFilter, RefreshCw } from "lucide-react";
import LogoutButton from "../components/LogoutButton";
import "./calendar.css";

type Order = {
  id: string; code: string; title: string; customerName: string; phone: string | null;
  address: string | null; description: string | null; priority: string; status: string;
  assignedTeam: string | null; scheduledAt: string | null; technology: string | null;
  ponPort: string | null; createdAt: string;
};
const statusLabel: Record<string,string> = { OPEN:"Aberta", SCHEDULED:"Agendada", IN_PROGRESS:"Em execução", REVIEW:"Em análise", COMPLETED:"Concluída", CANCELLED:"Cancelada" };
const priorityLabel: Record<string,string> = { LOW:"Baixa", NORMAL:"Normal", HIGH:"Alta", URGENT:"Urgente" };
const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const pad = (n:number) => String(n).padStart(2,"0");
const dayKey = (d:Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

export default function CalendarPage() {
  const now = new Date();
  const [year,setYear] = useState(now.getFullYear());
  const [month,setMonth] = useState(now.getMonth());
  const [orders,setOrders] = useState<Order[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [selectedDay,setSelectedDay] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/orders",{cache:"no-store"});
      const raw = await response.text();
      let data: {orders?:Order[];error?:string} = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error("O servidor devolveu uma resposta inválida. Tenta atualizar."); }
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as ordens.");
      setOrders(data.orders || []);
    } catch(e) { setError(e instanceof Error ? e.message : "Erro ao carregar o calendário."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); },[]);
  const scheduled = useMemo(()=>orders.filter(o=>o.scheduledAt && o.status!=="CANCELLED"),[orders]);
  const counts = useMemo(()=>{
    const map:Record<string,number>={};
    scheduled.forEach(o=>{ const key=dayKey(new Date(o.scheduledAt!)); map[key]=(map[key]||0)+1; });
    return map;
  },[scheduled]);
  const firstWeekday = (new Date(year,month,1).getDay()+6)%7;
  const daysInMonth = new Date(year,month+1,0).getDate();
  const cells = [...Array(firstWeekday).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while(cells.length%7) cells.push(null);
  const monthName = new Intl.DateTimeFormat("pt-BR",{month:"long"}).format(new Date(year,month,1));
  const dayOrders = selectedDay ? scheduled.filter(o=>dayKey(new Date(o.scheduledAt!))===selectedDay).sort((a,b)=>new Date(a.scheduledAt!).getTime()-new Date(b.scheduledAt!).getTime()) : [];
  const hours = Array.from({length:14},(_,i)=>i+7); // 07:00–20:00
  function moveMonth(delta:number) { const d=new Date(year,month+delta,1); setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDay(null); }
  function chooseDay(day:number) { setSelectedDay(`${year}-${pad(month+1)}-${pad(day)}`); }
  function timeOf(o:Order) { return new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit"}).format(new Date(o.scheduledAt!)); }
  function ordersAtHour(hour:number) { return dayOrders.filter(o=>new Date(o.scheduledAt!).getHours()===hour); }

  return <main className="calendar-page">
    <header className="calendar-top"><Link href="/" className="calendar-back"><ArrowLeft size={17}/> Painel inicial</Link><div className="calendar-top-right"><span>Planeamento operacional</span><LogoutButton/></div></header>
    <div className="calendar-content">
      <section className="calendar-heading"><div><small>OPERAÇÃO / PLANEAMENTO</small><h1><CalendarDays size={29}/> Calendário de serviços</h1><p>Consulta as intervenções agendadas e abre qualquer dia para ver as ordens por horário.</p></div><button className="calendar-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={16} className={loading?"calendar-spin":""}/> Atualizar</button></section>
      {error&&<div className="calendar-error">{error}</div>}
      <section className="calendar-board">
        <div className="calendar-controls"><div className="calendar-month-title"><span>{monthName}</span><b>{year}</b></div><div className="calendar-pickers"><button aria-label="Mês anterior" onClick={()=>moveMonth(-1)}><ChevronLeft size={18}/></button><select aria-label="Mês" value={month} onChange={e=>{setMonth(Number(e.target.value));setSelectedDay(null)}}>{Array.from({length:12},(_,i)=><option value={i} key={i}>{new Intl.DateTimeFormat("pt-BR",{month:"long"}).format(new Date(2026,i,1))}</option>)}</select><select aria-label="Ano" value={year} onChange={e=>{setYear(Number(e.target.value));setSelectedDay(null)}}>{Array.from({length:11},(_,i)=>now.getFullYear()-5+i).map(y=><option key={y} value={y}>{y}</option>)}</select><button aria-label="Mês seguinte" onClick={()=>moveMonth(1)}><ChevronRight size={18}/></button><button className="calendar-today" onClick={()=>{setYear(now.getFullYear());setMonth(now.getMonth());setSelectedDay(dayKey(now));}}>Hoje</button></div></div>
        <div className="calendar-legend"><span><i className="legend-booked"/> Dia com serviços</span><span><i className="legend-free"/> Dia sem serviços</span><span className="calendar-legend-note">Seleciona um dia para ver os horários</span></div>
        <div className="calendar-grid">{weekdays.map(d=><div className="calendar-weekday" key={d}>{d}</div>)}{cells.map((day,i)=>{if(!day)return <div className="calendar-cell calendar-blank" key={"blank-"+i}/>;const key=`${year}-${pad(month+1)}-${pad(day)}`;const count=counts[key]||0;const isToday=key===dayKey(now);return <button key={key} onClick={()=>chooseDay(day)} className={`calendar-cell calendar-day ${count?"has-orders":"no-orders"} ${selectedDay===key?"is-selected":""} ${isToday?"is-today":""}`}><span className="calendar-day-number">{day}</span>{count>0?<span className="calendar-count">{count} {count===1?"ordem":"ordens"}</span>:<span className="calendar-empty-label">Livre</span>}</button>})}</div>
        <div className="calendar-board-footer"><span><ListFilter size={15}/> {scheduled.length} ordens com data/hora agendada</span><span>Verde = com ordem · Azul = sem ordem</span></div>
      </section>
      {selectedDay&&<section className="calendar-day-panel" id="day-details">
        <div className="calendar-day-heading"><div><small>DETALHE DO DIA</small><h2>{new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(year,month,Number(selectedDay.slice(-2))))}</h2><p>{dayOrders.length} {dayOrders.length===1?"ordem agendada":"ordens agendadas"}</p></div><button onClick={()=>setSelectedDay(null)}>Fechar</button></div>
        {loading?<div className="calendar-no-orders">A carregar ordens…</div>:<div className="calendar-hour-list">{hours.map(hour=>{const list=ordersAtHour(hour);return <div key={hour} className={`calendar-hour ${list.length?"hour-booked":"hour-free"}`}><div className="calendar-hour-label"><Clock3 size={16}/><b>{pad(hour)}:00</b><span>{list.length?list.length+" ordem(ns)":"Disponível"}</span></div><div className="calendar-hour-orders">{list.length?list.map(o=><article className="calendar-order-card" key={o.id}><div className="calendar-order-main"><strong>{o.title}</strong><span>{o.code} · {o.customerName}</span><small>{timeOf(o)}{o.assignedTeam?" · Equipa: "+o.assignedTeam:""}{o.technology?" · "+o.technology:""}{o.ponPort?" · PON "+o.ponPort:""}</small>{o.address&&<small>{o.address}</small>}</div><div className="calendar-order-tags"><span className={"calendar-status status-"+o.status.toLowerCase()}>{statusLabel[o.status]||o.status}</span><span className={"calendar-priority priority-"+o.priority.toLowerCase()}>{priorityLabel[o.priority]||o.priority}</span></div></article>):<div className="calendar-free-message">Sem ordens neste horário</div>}</div></div>})}</div>}
        {dayOrders.length>0&&<div className="calendar-day-summary">As ordens estão ordenadas pela hora de início. Os horários sem ordem aparecem a azul; os horários ocupados aparecem a verde.</div>}
      </section>}
      <footer className="calendar-footer">ISP Manager · Calendário de serviços · As ordens são lidas da base de dados atual.</footer>
    </div>
  </main>;
}
