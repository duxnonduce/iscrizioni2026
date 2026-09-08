import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Entra in campo con Micolani Tennis",
  description: "Modulo di iscrizione Micolani Tennis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="font-body min-h-screen">{children}</body>
    </html>
  );
}
