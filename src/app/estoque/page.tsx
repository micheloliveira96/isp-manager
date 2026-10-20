"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Package, Plus, RotateCcw, Search, Truck, UserRound, Users, LoaderCircle, Boxes, AlertTriangle } from "lucide-react";
import LogoutButton from "../components/LogoutButton";
import "./inventory.css";

type Product = { id:string; name:string; category:string; sku:string|null; unit:string; quantityOnHand:number; minQuantity:number; notes:string|null };
type Target = { id:string; name:string; teamId?:string|null; plate?:string; model?:string };
type Assignment = { id:string; quantity:number; assignedAt:string; notes:string|null; product:{id:string;name:string;category:string;unit:string}; technician:{id:string;name:string}|null; team:{id:string;name:string}|null; vehicle:{id:string;plate:string;model:string}|null };
type InventoryData = { products:Product[]; assignments:Assignment[]; technicians:Target[]; teams:Target[]; vehicles:Target[] };
const blankProduct = { name:"",category:"ONU",sku:"",unit:"UN",quantityOnHand:"0",minQuantity:"0",notes:"" };
const blankAssignment = { productId:"",quantity:"1",technicianId:"",teamId:"",vehicleId:"",notes:"" };
const categoryLabels:Record<string,string> = { ONU:"ONU",ONT:"ONT",ROUTER:"Roteador",DROP_CABLE_BOX:"Caixa de cabo drop",FIBER_CABLE_BOX:"Caixa de cabo de fibra",CABLE:"Cabo",CONNECTOR:"Conector",TOOLS:"Ferramentas",OTHER:"Outros" };
const unitLabels:Record<string,string> = { UN:"unidades",CAIXA:"caixas",METRO:"metros",ROLO:"rolos",PACOTE:"pacotes" };

export default function InventoryPage() {
  const [data,setData] = useState<InventoryData>({products:[],assignments:[],technicians:[],teams:[],vehicles:[]});
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [showProduct,setShowProduct] = useState(false);
  const [showAssignment,setShowAssignment] = useState(false);
  const [productForm,setProductForm] = useState(blankProduct);
  const [assignmentForm,setAssignmentForm] = useState(blankAssignment);
  const [restockValues,setRestockValues] = useState<Record<string,string>>({});
  const [query,setQuery] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  async function load() {
    try {
      const r = await fetch("/api/inventory",{cache:"no-store"});
      const d = await r.json();
      if(!r.ok) throw new Error(d.error || "Não foi possível carregar o estoque.");
      setData(d);
      setAssignmentForm(v=>({...v,productId:v.productId || d.products?.[0]?.id || ""}));
    } catch(e) { setError(e instanceof Error ? e.message : "Erro ao carregar o estoque."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{load()},[]);
  async function submitProduct(e:FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const r=await fetch("/api/inventory",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...productForm,action:"product",quantityOnHand:Number(productForm.quantityOnHand),minQuantity:Number(productForm.minQuantity)})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error || "Não foi possível cadastrar o produto.");
      setProductForm(blankProduct); setShowProduct(false); setNotice("Produto cadastrado no estoque."); await load();
    } catch(e) {setError(e instanceof Error?e.message:"Erro ao cadastrar produto.");}
    finally {setSaving(false);}
  }
  async function submitAssignment(e:FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const r=await fetch("/api/inventory",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...assignmentForm,action:"assign",quantity:Number(assignmentForm.quantity)})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error || "Não foi possível associar o material.");
      setAssignmentForm({...blankAssignment,productId:data.products[0]?.id || ""}); setShowAssignment(false); setNotice("Material associado. A quantidade disponível foi atualizada."); await load();
    } catch(e) {setError(e instanceof Error?e.message:"Erro ao associar material.");}
    finally {setSaving(false);}
  }
  async function restock(productId:string) {
    const quantity=Number(restockValues[productId] || 0);
    if(!Number.isInteger(quantity)||quantity<1){setError("Informe uma quantidade de reposição maior que zero.");return;}
    setSaving(true);setError("");setNotice("");
    try {
      const r=await fetch("/api/inventory",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"restock",productId,quantity})});
      const d=await r.json();if(!r.ok)throw new Error(d.error || "Não foi possível repor o estoque.");
      setRestockValues(v=>({...v,[productId]:""}));setNotice("Entrada de material registrada.");await load();
    } catch(e){setError(e instanceof Error?e.message:"Erro ao repor estoque.");}
    finally{setSaving(false);}
  }
  async function returnMaterial(id:string) {
    if(!confirm("Confirmar a devolução desse material ao estoque?")) return;
    setSaving(true);setError("");setNotice("");
    try {
      const r=await fetch("/api/inventory",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
      const d=await r.json();if(!r.ok)throw new Error(d.error || "Não foi possível registrar a devolução.");
      setNotice("Devolução registrada e quantidade devolvida ao estoque.");await load();
    } catch(e){setError(e instanceof Error?e.message:"Erro ao registrar devolução.");}
    finally{setSaving(false);}
  }
  const products=data.products.filter(p=>(p.name+" "+(p.sku||"")+" "+(categoryLabels[p.category]||p.category)).toLowerCase().includes(query.toLowerCase()));
  const totalUnits=data.products.reduce((sum,p)=>sum+p.quantityOnHand,0);
  const lowStock=data.products.filter(p=>p.quantityOnHand<=p.minQuantity).length;

  return <main className="inventory-page">
    <header className="inventory-top"><Link href="/" className="inventory-back"><ArrowLeft size={17}/> Painel inicial</Link><div>Operação <LogoutButton/></div></header>
    <div className="inventory-content">
      <div className="inventory-heading"><div><small>OPERAÇÃO / MATERIAIS</small><h1>Estoque e equipamentos</h1><p>Controle produtos, quantidades e materiais entregues aos técnicos, equipes e veículos.</p></div><button onClick={()=>setShowProduct(v=>!v)}><Plus size={16}/> Adicionar produto</button></div>
      {error&&<div className="inventory-alert error">{error}</div>}{notice&&<div className="inventory-alert success">{notice}</div>}
      <div className="inventory-stats"><article><span>Produtos cadastrados</span><b>{data.products.length}</b><small>Tipos de materiais</small></article><article><span>Unidades disponíveis</span><b>{totalUnits}</b><small>Saldo total no estoque</small></article><article className={lowStock?"inventory-stat-warning":""}><span>Estoque baixo</span><b>{lowStock}</b><small>Produtos no mínimo ou abaixo dele</small></article><article><span>Materiais em uso</span><b>{data.assignments.length}</b><small>Associações ativas</small></article></div>
      {showProduct&&<form className="inventory-card" onSubmit={submitProduct}><header><Package size={20}/><div><h2>Novo produto</h2><p>Cadastre o material e o saldo inicial disponível.</p></div></header><div className="inventory-fields">
        <label>Nome do produto *<input required maxLength={120} value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="Ex.: ONU GPON, roteador Wi-Fi"/></label>
        <label>Categoria<select value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}>{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Código SKU (opcional)<input maxLength={80} value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})} placeholder="Código interno"/></label>
        <label>Unidade de medida<select value={productForm.unit} onChange={e=>setProductForm({...productForm,unit:e.target.value})}>{Object.entries(unitLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Quantidade inicial *<input type="number" min="0" step="1" required value={productForm.quantityOnHand} onChange={e=>setProductForm({...productForm,quantityOnHand:e.target.value})}/></label>
        <label>Alerta de estoque mínimo<input type="number" min="0" step="1" value={productForm.minQuantity} onChange={e=>setProductForm({...productForm,minQuantity:e.target.value})}/></label>
        <label className="inventory-wide">Observações<textarea maxLength={1000} rows={2} value={productForm.notes} onChange={e=>setProductForm({...productForm,notes:e.target.value})} placeholder="Marca, modelo, especificações..."/></label>
      </div><footer><button type="button" className="inventory-secondary" onClick={()=>setShowProduct(false)}>Cancelar</button><button type="submit" disabled={saving}>{saving?"Salvando...":"Salvar produto"}</button></footer></form>}
      <section className="inventory-card">
        <div className="inventory-section-head"><div><h2>Produtos no estoque</h2><p>O saldo diminui ao associar materiais e aumenta ao registrar devoluções ou reposições.</p></div><label className="inventory-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto ou SKU"/></label></div>
        {loading?<div className="inventory-empty"><LoaderCircle className="inventory-spin" size={24}/>Carregando estoque...</div>:products.length===0?<div className="inventory-empty"><Boxes size={28}/><b>Nenhum produto encontrado</b><span>Adicione produtos para começar a controlar o estoque.</span></div>:<div className="inventory-product-grid">{products.map(p=><article className="inventory-product" key={p.id}><div className="inventory-product-top"><span className="inventory-product-icon"><Package size={19}/></span><span className={"inventory-stock-pill "+(p.quantityOnHand<=p.minQuantity?"low":"")}>{p.quantityOnHand<=p.minQuantity?<AlertTriangle size={12}/>:null}{p.quantityOnHand<=p.minQuantity?"Estoque baixo":"Disponível"}</span></div><small>{categoryLabels[p.category]||p.category}{p.sku?" · SKU "+p.sku:""}</small><h3>{p.name}</h3><div className="inventory-quantity"><b>{p.quantityOnHand}</b><span>{unitLabels[p.unit]||p.unit}</span></div><div className="inventory-stock-meter"><span style={{width:(p.quantityOnHand===0?0:Math.min(100,p.quantityOnHand/Math.max(p.minQuantity*2,1)*100))+"%"}}/></div><p>Estoque mínimo: {p.minQuantity} {unitLabels[p.unit]||p.unit}</p><div className="inventory-restock"><input aria-label={"Quantidade para repor "+p.name} type="number" min="1" step="1" value={restockValues[p.id]||""} onChange={e=>setRestockValues(v=>({...v,[p.id]:e.target.value}))} placeholder="Qtd."/><button disabled={saving} onClick={()=>restock(p.id)}>Registrar entrada</button></div></article>)}</div>}
      </section>
      <section className="inventory-card">
        <div className="inventory-section-head"><div><h2>Materiais com técnicos, equipes e veículos</h2><p>Veja o que foi retirado do estoque e onde cada material está alocado.</p></div><button onClick={()=>setShowAssignment(v=>!v)} disabled={!data.products.length}><Plus size={15}/> Associar material</button></div>
        {showAssignment&&<form className="inventory-assignment-form" onSubmit={submitAssignment}><div className="inventory-fields">
          <label>Produto *<select required value={assignmentForm.productId} onChange={e=>setAssignmentForm({...assignmentForm,productId:e.target.value})}><option value="">Selecione um produto</option>{data.products.map(p=><option key={p.id} value={p.id}>{p.name} — disponível: {p.quantityOnHand}</option>)}</select></label>
          <label>Quantidade *<input type="number" min="1" step="1" required value={assignmentForm.quantity} onChange={e=>setAssignmentForm({...assignmentForm,quantity:e.target.value})}/></label>
          <label>Técnico<select value={assignmentForm.technicianId} onChange={e=>setAssignmentForm({...assignmentForm,technicianId:e.target.value})}><option value="">Nenhum técnico</option>{data.technicians.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>Equipe<select value={assignmentForm.teamId} onChange={e=>setAssignmentForm({...assignmentForm,teamId:e.target.value})}><option value="">Nenhuma equipe</option>{data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>Veículo / carro<select value={assignmentForm.vehicleId} onChange={e=>setAssignmentForm({...assignmentForm,vehicleId:e.target.value})}><option value="">Nenhum veículo</option>{data.vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}</select></label>
          <label>Observações<input maxLength={1000} value={assignmentForm.notes} onChange={e=>setAssignmentForm({...assignmentForm,notes:e.target.value})} placeholder="Ex.: material colocado no carro"/></label>
        </div><p className="inventory-form-hint">Selecione pelo menos um destino. Você pode vincular o material à equipe e ao veículo ao mesmo tempo.</p><footer><button type="button" className="inventory-secondary" onClick={()=>setShowAssignment(false)}>Cancelar</button><button type="submit" disabled={saving}>{saving?"Salvando...":"Confirmar associação"}</button></footer></form>}
        {loading?<div className="inventory-empty"><LoaderCircle className="inventory-spin" size={24}/>Carregando associações...</div>:data.assignments.length===0?<div className="inventory-empty"><Boxes size={28}/><b>Nenhum material associado</b><span>Quando um produto for entregue, ele aparecerá nesta lista.</span></div>:<div className="inventory-assignment-list">{data.assignments.map(a=><article key={a.id}><div className="inventory-assignment-icon"><Package size={18}/></div><div className="inventory-assignment-info"><b>{a.product.name} <span>× {a.quantity} {unitLabels[a.product.unit]||a.product.unit}</span></b><small>{[a.technician?.name,a.team?.name,a.vehicle?[a.vehicle.plate,a.vehicle.model].join(" — "):null].filter(Boolean).join(" · ")}</small>{a.notes&&<small>{a.notes}</small>}<small>Associado em {new Intl.DateTimeFormat("pt-BR",{dateStyle:"short"}).format(new Date(a.assignedAt))}</small></div><button className="inventory-return" disabled={saving} onClick={()=>returnMaterial(a.id)}><RotateCcw size={14}/> Registrar devolução</button></article>)}</div>}
      </section>
      <p className="inventory-footnote"><UserRound size={13}/> As quantidades são separadas por empresa. As operações de estoque ficam registradas no histórico de auditoria.</p>
    </div>
  </main>;
}
