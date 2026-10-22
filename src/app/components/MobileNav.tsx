"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, CalendarDays, ClipboardList, Gauge, HardHat, Menu, Package, Settings2, ShieldCheck, Truck, UserRound, Users, Wallet, Wifi, X, Clock3 } from "lucide-react";

export default function MobileNav({ manager, technician = false }: { manager: boolean; technician?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <>
    <button type="button" className="mobile-nav-trigger" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={22}/></button>
    {open && <div className="mobile-nav-backdrop" onClick={close}>
      <aside className="mobile-nav-drawer" aria-label={technician ? "Menu do técnico" : "Menu principal"} onClick={e => e.stopPropagation()}>
        <div className="mobile-nav-heading"><span><Wifi size={19}/> {technician ? "Área do técnico" : "ISP Manager"}</span><button type="button" aria-label="Fechar menu" onClick={close}><X size={22}/></button></div>
        <nav>
          {technician ? <>
            <p>ÁREA DO TÉCNICO</p>
            <Link href="/tecnicos#ordens" onClick={close}><ClipboardList size={18}/> As minhas ordens</Link>
            <Link href="/tecnicos#ponto" onClick={close}><Clock3 size={18}/> Ponto e assiduidade</Link>
            <Link href="/estoque" onClick={close}><Package size={18}/> Meus materiais</Link>
            <Link href="/frota" onClick={close}><Truck size={18}/> Meu veículo</Link>
          </> : <>
            <p>VISÃO GERAL</p>
            <Link href="/" onClick={close}><Activity size={18}/> Painel inicial</Link>
            <Link href="/ordens" onClick={close}><ClipboardList size={18}/> Ordens de serviço</Link>
            <Link href="/clientes" onClick={close}><UserRound size={18}/> Clientes</Link>
            <Link href="/planos" onClick={close}><Gauge size={18}/> Planos de internet</Link>
            <Link href="/mikrotik" onClick={close}><Wifi size={18}/> MikroTik e PPPoE</Link>
            <Link href="/financeiro" onClick={close}><Wallet size={18}/> Financeiro</Link>
            <Link href="/calendario" onClick={close}><CalendarDays size={18}/> Calendário operacional</Link>
            <p>OPERAÇÃO</p>
            <Link href="/equipes" onClick={close}><HardHat size={18}/> Equipas e técnicos</Link>
            <Link href="/estoque" onClick={close}><Package size={18}/> Stock e equipamentos</Link>
            <Link href="/frota" onClick={close}><Truck size={18}/> Frota</Link>
            <p>ADMINISTRAÇÃO</p>
            {manager && <Link href="/utilizadores" onClick={close}><Users size={18}/> Utilizadores</Link>}
            {manager && <Link href="/configuracoes/ordens" onClick={close}><Settings2 size={18}/> Parâmetros das ordens</Link>}
            {manager && <Link href="/configuracoes/identidade" onClick={close}><Settings2 size={18}/> Identidade visual</Link>}
            {manager && <Link href="/auditoria" onClick={close}><ShieldCheck size={18}/> Histórico de auditoria</Link>}
          </>}
        </nav>
      </aside>
    </div>}
  </>;
}
