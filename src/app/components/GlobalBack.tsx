"use client";
import {usePathname} from "next/navigation";
import BackButton from "./BackButton";
export default function GlobalBack(){const path=usePathname();if(path==="/"||path.startsWith("/login"))return null;return <div className="global-back-nav"><BackButton/></div>}
