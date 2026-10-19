"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function AppearanceToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("isp-manager-theme");
    const enabled = saved === "dark";
    setDark(enabled);
    document.documentElement.classList.toggle("dark-mode", enabled);
  }, []);

  function toggle() {
    const enabled = !dark;
    setDark(enabled);
    document.documentElement.classList.toggle("dark-mode", enabled);
    window.localStorage.setItem("isp-manager-theme", enabled ? "dark" : "light");
  }

  return (
    <button type="button" className="dash-theme-toggle" onClick={toggle} aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"} title={dark ? "Ativar modo claro" : "Ativar modo escuro"}>
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      <span>{dark ? "Modo claro" : "Modo escuro"}</span>
    </button>
  );
}
