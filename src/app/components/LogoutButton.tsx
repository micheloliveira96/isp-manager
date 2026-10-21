"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
export default function LogoutButton({ redirectTo = "/login" }: { redirectTo?: string }){const router=useRouter();return <button aria-label="Terminar sessão" title="Terminar sessão" onClick={async()=>{await fetch("/api/auth/logout",{method:"POST"});router.replace(redirectTo);router.refresh()}} style={{border:0,background:"transparent",color:"#8d97a8",cursor:"pointer",padding:4}}><LogOut size={16}/></button>}
