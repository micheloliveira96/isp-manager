import type { Metadata } from "next";
import "./globals.css";
import AppearanceToggle from "./components/AppearanceToggle";
import GlobalBack from "./components/GlobalBack";

export const metadata: Metadata = {
  title: "ISP Manager | Gestão operacional",
  description: "Plataforma de gestão operacional para provedores de Internet.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <AppearanceToggle />
        <GlobalBack />
      </body>
    </html>
  );
}
