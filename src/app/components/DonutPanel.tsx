import Link from "next/link";
type Slice={label:string;value:number;color:string};
export default function DonutPanel({title,slices,href,format="count"}:{title:string;slices:Slice[];href:string;format?:"count"|"money"}){
 const total=slices.reduce((n,s)=>n+s.value,0);let cursor=0;
 const gradient=total>0?slices.map(s=>{const start=cursor;cursor+=s.value/total*100;return `${s.color} ${start}% ${cursor}%`}).join(", "):"#30384a 0 100%";
 const display=(n:number)=>format==="money"?new Intl.NumberFormat("pt-PT",{style:"currency",currency:"EUR"}).format(n):n.toLocaleString("pt-BR");
 return <section className="dash-panel dash-chart-panel"><header><div><h2>{title}</h2><p>Dados reais do sistema</p></div><Link href={href}>Ver detalhes →</Link></header><div className="dash-chart-body"><div className="dash-donut" style={{background:`conic-gradient(${gradient})`}}><div><strong>{display(total)}</strong><small>Total</small></div></div><div className="dash-chart-legend">{slices.map(s=><div key={s.label}><i style={{background:s.color}}/><span>{s.label}</span><b>{display(s.value)}</b></div>)}</div></div></section>
}