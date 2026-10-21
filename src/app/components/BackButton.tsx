"use client";
import {useRouter} from "next/navigation";
import {ArrowLeft} from "lucide-react";
export default function BackButton(){const router=useRouter();return <button type="button" className="app-back-button" onClick={()=>{if(window.history.length>1)router.back();else router.push("/")}}><ArrowLeft size={16}/> Voltar</button>}
