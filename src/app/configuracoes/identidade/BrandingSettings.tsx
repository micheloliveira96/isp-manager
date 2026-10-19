"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, ImagePlus, RotateCcw, Save, ShieldCheck, Upload, X } from "lucide-react";
import "./branding.css";

type Brand = {
  companyName: string;
  productName: string;
  logo: string;
  primaryColor: string;
  accentColor: string;
  loginTitle: string;
  loginMessage: string;
  supportEmail: string;
  supportPhone: string;
};
const defaults: Brand = {
  companyName: "Netvia Telecom",
  productName: "ISP Manager",
  logo: "",
  primaryColor: "#4863ed",
  accentColor: "#22a77d",
  loginTitle: "Bem-vindo à Netvia Telecom",
  loginMessage: "Gestão operacional, simples e centralizada.",
  supportEmail: "suporte@netvia.example",
  supportPhone: "+55 11 0000-0000",
};
const STORAGE_KEY = "isp-manager-brand-demo-v1";

export default function BrandingSettings() {
  const [brand, setBrand] = useState<Brand>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value) setBrand({ ...defaults, ...JSON.parse(value) });
    } catch {
      setError("Não foi possível carregar as preferências locais deste navegador.");
    }
    setLoaded(true);
  }, []);

  function change<K extends keyof Brand>(key: K, value: Brand[K]) {
    setBrand((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Escolhe uma imagem PNG, JPG ou WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > 1_500_000) {
      setError("A imagem deve ter no máximo 1,5 MB para esta demonstração.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) change("logo", result);
    };
    reader.onerror = () => setError("Não foi possível ler a imagem selecionada.");
    reader.readAsDataURL(file);
  }

  function saveDemo() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
      setSaved(true);
      setError("");
    } catch {
      setError("O navegador não conseguiu guardar esta imagem/preferência. Tenta uma imagem menor.");
      setSaved(false);
    }
  }

  function resetDemo() {
    setBrand(defaults);
    localStorage.removeItem(STORAGE_KEY);
    setSaved(false);
    setError("");
  }

  return (
    <main className="brand-settings-shell">
      <header className="brand-settings-topbar">
        <Link href="/" className="brand-back"><ArrowLeft size={17}/> Voltar ao painel</Link>
        <div className="brand-top-meta"><span className="brand-online-dot"/> Demonstração local <span className="brand-user-chip">MC</span></div>
      </header>
      <div className="brand-settings-content">
        <div className="brand-breadcrumb"><span>Administração</span><ChevronRight size={13}/><span>Configurações</span><ChevronRight size={13}/><strong>Identidade visual</strong></div>
        <div className="brand-page-heading">
          <div><div className="brand-eyebrow">PERSONALIZAÇÃO POR EMPRESA</div><h1>Identidade visual</h1><p>Adapta a plataforma à marca do provedor, sem alterar o código do sistema.</p></div>
          <div className="brand-heading-icon"><ImagePlus size={23}/></div>
        </div>

        <div className="brand-demo-notice"><ShieldCheck size={18}/><div><strong>Modo de demonstração</strong><span>As alterações ficam guardadas apenas neste navegador. A gravação por empresa na base de dados será ligada depois de implementarmos login e permissões.</span></div><span className="brand-demo-tag">DEMO</span></div>

        <div className="brand-settings-grid">
          <section className="brand-form-card">
            <div className="brand-card-heading"><div><h2>Marca e apresentação</h2><p>Define como o cliente verá a plataforma.</p></div><span className="brand-step">01</span></div>
            <div className="brand-field"><label htmlFor="companyName">Nome da empresa</label><input id="companyName" value={brand.companyName} maxLength={70} onChange={e=>change("companyName",e.target.value)} placeholder="Ex.: Netvia Telecom"/><small>Nome do provedor que aparece no espaço de trabalho.</small></div>
            <div className="brand-field"><label htmlFor="productName">Nome apresentado no sistema</label><input id="productName" value={brand.productName} maxLength={50} onChange={e=>change("productName",e.target.value)} placeholder="Ex.: Netvia Gestão"/><small>Podes usar a tua própria marca comercial.</small></div>
            <div className="brand-field"><label>Logótipo</label><div className="brand-upload-area">{brand.logo ? <div className="brand-logo-preview"><img src={brand.logo} alt="Pré-visualização do logótipo carregado"/><button type="button" onClick={()=>change("logo","")} aria-label="Remover logótipo"><X size={15}/></button></div> : <div className="brand-upload-empty"><div className="brand-upload-icon"><Upload size={19}/></div><div><strong>Carregar o logótipo</strong><span>PNG, JPG ou WebP · máximo 1,5 MB</span></div></div>}<label className="brand-upload-button" htmlFor="logoUpload">{brand.logo ? "Substituir imagem" : "Escolher imagem"}</label><input id="logoUpload" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo}/></div><small>Na versão comercial, a imagem será guardada em armazenamento seguro da empresa.</small></div>
            <div className="brand-card-divider"/>
            <div className="brand-card-heading"><div><h2>Cores da plataforma</h2><p>Escolhe as cores principais da tua marca.</p></div><span className="brand-step">02</span></div>
            <div className="brand-color-grid"><div className="brand-field"><label htmlFor="primaryColor">Cor primária</label><div className="brand-color-input"><input id="primaryColor" type="color" value={brand.primaryColor} onChange={e=>change("primaryColor",e.target.value)}/><input aria-label="Código da cor primária" value={brand.primaryColor} maxLength={7} onChange={e=>/^#[0-9a-fA-F]{6}$/.test(e.target.value)&&change("primaryColor",e.target.value)}/></div></div><div className="brand-field"><label htmlFor="accentColor">Cor de destaque</label><div className="brand-color-input"><input id="accentColor" type="color" value={brand.accentColor} onChange={e=>change("accentColor",e.target.value)}/><input aria-label="Código da cor de destaque" value={brand.accentColor} maxLength={7} onChange={e=>/^#[0-9a-fA-F]{6}$/.test(e.target.value)&&change("accentColor",e.target.value)}/></div></div></div>
            <div className="brand-card-divider"/>
            <div className="brand-card-heading"><div><h2>Página de entrada</h2><p>Personaliza a mensagem que recebe o utilizador.</p></div><span className="brand-step">03</span></div>
            <div className="brand-field"><label htmlFor="loginTitle">Título de boas-vindas</label><input id="loginTitle" value={brand.loginTitle} maxLength={90} onChange={e=>change("loginTitle",e.target.value)}/></div>
            <div className="brand-field"><label htmlFor="loginMessage">Mensagem de apresentação</label><textarea id="loginMessage" value={brand.loginMessage} rows={3} maxLength={220} onChange={e=>change("loginMessage",e.target.value)}/></div>
            <div className="brand-card-divider"/>
            <div className="brand-card-heading"><div><h2>Contactos de suporte</h2><p>Informações que podem aparecer na área de ajuda.</p></div><span className="brand-step">04</span></div>
            <div className="brand-two-fields"><div className="brand-field"><label htmlFor="supportEmail">Email de suporte</label><input id="supportEmail" type="email" value={brand.supportEmail} maxLength={120} onChange={e=>change("supportEmail",e.target.value)}/></div><div className="brand-field"><label htmlFor="supportPhone">Telefone</label><input id="supportPhone" value={brand.supportPhone} maxLength={40} onChange={e=>change("supportPhone",e.target.value)}/></div></div>
            {error && <p className="brand-error" role="alert">{error}</p>}
            <div className="brand-form-actions"><button type="button" className="brand-reset" onClick={resetDemo}><RotateCcw size={15}/> Restaurar padrão</button><button type="button" className="brand-save" onClick={saveDemo}><Save size={15}/> Guardar demonstração</button></div>
            {saved && <div className="brand-saved-message" role="status"><Check size={15}/> Preferências guardadas neste navegador.</div>}
            {!loaded && <div className="brand-loading">A carregar preferências locais…</div>}
          </section>

          <aside className="brand-preview-column">
            <div className="brand-preview-sticky">
              <div className="brand-preview-title"><div><h2>Pré-visualização</h2><p>Atualiza-se enquanto editas.</p></div><span className="brand-preview-live"><i/> AO VIVO</span></div>
              <div className="brand-preview-window">
                <div className="brand-preview-sidebar"><div className="brand-preview-logo-area">{brand.logo ? <img className="brand-preview-logo-img" src={brand.logo} alt="Logótipo da empresa"/> : <div className="brand-preview-mark" style={{background:brand.primaryColor}}>{(brand.companyName.trim()[0]||"N").toUpperCase()}</div>}<div><strong>{brand.productName||"Nome do sistema"}</strong><small>GESTÃO OPERACIONAL</small></div></div><div className="brand-preview-company"><div className="brand-preview-company-icon" style={{color:brand.primaryColor,background:brand.primaryColor+"1a"}}>{(brand.companyName.trim()[0]||"N").toUpperCase()}</div><span>{brand.companyName||"Nome da empresa"}</span></div><div className="brand-preview-nav"><b style={{background:brand.primaryColor+"12",color:brand.primaryColor}}>▦　Painel inicial</b><span>▤　Ordens de serviço</span><span>▦　Calendário</span><span>♙　Técnicos</span><span>▧　Equipamentos</span></div></div>
                <div className="brand-preview-main"><div className="brand-preview-topline"><span>{brand.companyName||"Empresa"} / Painel</span><i>MC</i></div><div className="brand-preview-greeting"><span>VISÃO GERAL</span><h3>{brand.loginTitle||"Bem-vindo"}</h3><p>{brand.loginMessage||"Mensagem de apresentação"}</p></div><div className="brand-preview-metrics"><div><span>Ordens abertas</span><b>24</b><i style={{background:brand.primaryColor+"20",color:brand.primaryColor}}>+8,3%</i></div><div><span>Equipas ativas</span><b>08</b><i style={{background:brand.accentColor+"20",color:brand.accentColor}}>Em campo</i></div></div><div className="brand-preview-panel"><div className="brand-preview-panel-heading"><b>Ordens recentes</b><span>Ver todas →</span></div><div className="brand-preview-row"><i style={{background:brand.primaryColor}}/><div><b>Instalação FTTH</b><span>OS-0148 · Setor Norte</span></div><em>Em curso</em></div><div className="brand-preview-row"><i style={{background:brand.accentColor}}/><div><b>Manutenção</b><span>OS-0146 · Setor Sul</span></div><em>Agendada</em></div></div></div>
              </div>
              <div className="brand-preview-help"><ShieldCheck size={16}/><span>Esta pré-visualização usa apenas dados demonstrativos.</span></div>
              <div className="brand-preview-summary"><strong>Personalização ativa nesta pré-visualização</strong><div><span>Cor primária</span><b><i style={{background:brand.primaryColor}}/>{brand.primaryColor}</b></div><div><span>Cor de destaque</span><b><i style={{background:brand.accentColor}}/>{brand.accentColor}</b></div><div><span>Logótipo</span><b>{brand.logo?"Carregado":"Padrão"}</b></div></div>
            </div>
          </aside>
        </div>
        <footer className="brand-settings-footer"><span>{brand.productName||"ISP Manager"} · Personalização de demonstração</span><Link href="/">Regressar ao painel <ArrowLeft size={13}/></Link></footer>
      </div>
    </main>
  );
}
