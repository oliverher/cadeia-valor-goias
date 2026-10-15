import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cadeia de Valor Integrada | Goiás",
  description: "Painel interativo da Cadeia de Valor Integrada do Estado de Goiás.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
