"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function AppearanceToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const enabled = window.localStorage.getItem("isp-manager-theme") === "dark";
    setDark(enabled);
    document.documentElement.classList.toggle("dark-mode", enabled);
  }, []);

  function toggle() {
    const enabled = !document.documentElement.classList.contains("dark-mode");
    document.documentElement.classList.toggle("dark-mode", enabled);
    window.localStorage.setItem("isp-manager-theme", enabled ? "dark" : "light");
    setDark(enabled);
  }

  return (
    <button
      type="button"
      className="global-theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={dark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{dark ? "Modo claro" : "Modo escuro"}</span>
    </button>
  );
}
