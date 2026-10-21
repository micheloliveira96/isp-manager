"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Clock3, MapPin, RefreshCw, ShieldCheck } from "lucide-react";

type EventType = "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT";
type RecordItem = { id: string; eventType: EventType; occurredAt: string; photoData: string | null; latitude: number | null; longitude: number | null; notes: string | null };
const labels: Record<EventType, string> = { CLOCK_IN: "Entrada", BREAK_START: "Início da pausa", BREAK_END: "Regresso da pausa", CLOCK_OUT: "Saída" };
const sequence: EventType[] = ["CLOCK_IN", "BREAK_START", "BREAK_END", "CLOCK_OUT"];
const fmt = (value: string) => new Date(value).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });

export default function AttendancePanel() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [nextEvent, setNextEvent] = useState<EventType>("CLOCK_IN");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photo, setPhoto] = useState("");
  const [location, setLocation] = useState<{latitude:number;longitude:number} | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/attendance", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o histórico.");
      setRecords(data.records || []); setNextEvent(data.nextEvent || "CLOCK_IN");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar ponto."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); return () => { streamRef.current?.getTracks().forEach(t => t.stop()); }; }, []);

  async function openCamera() {
    setError(""); setNotice("");
    if (!navigator.mediaDevices?.getUserMedia) { setError("A câmara precisa de HTTPS e de autorização do navegador."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream; setCameraOpen(true);
      window.setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); } }, 100);
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setLocation({latitude:p.coords.latitude,longitude:p.coords.longitude}), () => setLocation(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
    } catch { setError("Não foi possível abrir a câmara. Autoriza o acesso à câmara nas definições do navegador e tenta novamente."); }
  }
  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setError("A câmara ainda está a iniciar. Tenta novamente."); return; }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 800 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) { setError("Não foi possível capturar a fotografia."); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.72));
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCameraOpen(false);
  }
  async function submit() {
    if (!photo) { setError("Tira uma fotografia antes de registar o ponto."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/attendance", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({eventType:nextEvent,photoData:photo,...(location||{})}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível registar o ponto.");
      setNotice(data.message || "Batida registada."); setPhoto(""); setLocation(null); await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Erro ao registar."); }
    finally { setBusy(false); }
  }
  const today = records.filter(r => new Date(r.occurredAt).toDateString() === new Date().toDateString());
  const completed = today.map(r => r.eventType);
  const step = sequence.indexOf(nextEvent);
  return <section style={{maxWidth:1180,margin:"0 auto 24px",background:"var(--card,#fff)",border:"1px solid var(--border,#e2e8f0)",borderRadius:16,padding:20,boxShadow:"0 5px 22px #15274a08"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h2 style={{margin:"0 0 6px",fontSize:24}}>Ponto e assiduidade</h2><p style={{margin:0,opacity:.7}}>Regista a entrada, a pausa, o regresso e a saída com fotografia.</p></div><button onClick={()=>void load()} style={btn}><RefreshCw size={16}/> Atualizar</button></div>
    {error && <p role="alert" style={alert}>{error}</p>}{notice && <p role="status" style={{...alert,background:"#e7f8ef",color:"#17663b"}}><ShieldCheck size={17}/> {notice}</p>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:10,margin:"20px 0"}}>
      {sequence.map((event,i)=><div key={event} style={{padding:12,borderRadius:12,border:"1px solid var(--border,#e2e8f0)",background:completed.includes(event)?"#e7f8ef":event===nextEvent?"var(--muted,#eef2ff)":"transparent"}}><small style={{opacity:.65}}>ETAPA {i+1}</small><div style={{fontWeight:700,marginTop:4}}>{labels[event]}</div><small>{completed.includes(event)?"Registado hoje":event===nextEvent?"Próxima batida":"Por fazer"}</small></div>)}
    </div>
    {!cameraOpen && !photo && <button onClick={()=>void openCamera()} disabled={busy||loading} style={{...btn,background:"#334de6",color:"#fff",borderColor:"#334de6",padding:"12px 16px"}}><Camera size={18}/> Bater ponto: {labels[nextEvent]}</button>}
    {cameraOpen && <div style={{marginTop:14}}><video ref={videoRef} playsInline muted style={{display:"block",width:"100%",maxWidth:420,maxHeight:420,objectFit:"cover",borderRadius:14,background:"#111"}}/><p style={{fontSize:13,opacity:.7}}>A fotografia será guardada com a hora do servidor. A localização GPS é opcional.</p><button onClick={takePhoto} style={btn}><Camera size={17}/> Tirar fotografia</button><button onClick={()=>{streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setCameraOpen(false);}} style={{...btn,marginLeft:8}}>Cancelar</button></div>}
    {photo && <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",marginTop:14}}><img src={photo} alt="Fotografia capturada para a batida" style={{width:120,height:120,objectFit:"cover",borderRadius:12}}/><div><p style={{marginTop:0}}>Confirma a fotografia para registar <b>{labels[nextEvent].toLowerCase()}</b>.</p>{location&&<p style={{fontSize:13,opacity:.7}}><MapPin size={14} style={{verticalAlign:"middle"}}/> Localização capturada</p>}<button onClick={()=>void submit()} disabled={busy} style={{...btn,background:"#17663b",color:"#fff"}}>{busy?"A registar…":"Confirmar batida"}</button><button onClick={()=>setPhoto("")} disabled={busy} style={{...btn,marginLeft:8}}>Repetir fotografia</button></div></div>}
    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:16,fontSize:13,opacity:.7}}><Clock3 size={16}/> {today.length} batida(s) registada(s) hoje · Os registos são guardados com a hora do servidor.</div>
    <hr style={{border:0,borderTop:"1px solid var(--border,#e2e8f0)",margin:"22px 0"}}/><h3 style={{marginTop:0}}>Histórico de batidas</h3>
    {loading?<p>A carregar histórico…</p>:records.length===0?<p style={{opacity:.7}}>Ainda não existem batidas registadas.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}><thead><tr>{["Data e hora","Registo","Fotografia","Localização"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>{records.map(r=><tr key={r.id}><td style={td}>{fmt(r.occurredAt)}</td><td style={td}>{labels[r.eventType]||r.eventType}</td><td style={td}>{r.photoData?<a href={r.photoData} target="_blank" rel="noreferrer"><img src={r.photoData} alt={"Fotografia: "+labels[r.eventType]} style={{width:48,height:48,objectFit:"cover",borderRadius:8}}/></a>:"—"}</td><td style={td}>{r.latitude!==null&&r.longitude!==null?<a href={"https://www.google.com/maps?q="+r.latitude+","+r.longitude} target="_blank" rel="noreferrer">Ver mapa</a>:"Não partilhada"}</td></tr>)}</tbody></table></div>}
    <p style={{fontSize:12,opacity:.65,marginBottom:0}}>As fotografias ficam guardadas na base de dados nesta versão de desenvolvimento. Antes de publicar, recomenda-se migrá-las para armazenamento privado de ficheiros.</p>
  </section>;
}
const btn:React.CSSProperties={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,border:"1px solid var(--border,#d9e0ed)",borderRadius:10,padding:"10px 14px",cursor:"pointer",background:"var(--card,#fff)",color:"inherit",fontWeight:600};
const alert:React.CSSProperties={display:"flex",alignItems:"center",gap:8,padding:12,borderRadius:10,background:"#fff0f0",color:"#a12828"};
const th:React.CSSProperties={textAlign:"left",padding:"10px 8px",borderBottom:"1px solid var(--border,#e2e8f0)"};
const td:React.CSSProperties={padding:"10px 8px",borderBottom:"1px solid var(--border,#e2e8f0)",verticalAlign:"middle"};
