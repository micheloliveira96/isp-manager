import type { Metadata } from "next";
import "./globals.css";
import AppearanceToggle from "./components/AppearanceToggle";

export const metadata: Metadata = {
  title: "ISP Manager | Gestão operacional",
  description: "Plataforma de gestão operacional para provedores de Internet.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT">
      <body>
        {children}
        <AppearanceToggle />
      </body>
    </html>
  );
}
