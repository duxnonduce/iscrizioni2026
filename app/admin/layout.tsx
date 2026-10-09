import { DM_Sans, Space_Grotesk } from "next/font/google";

// Font usati solo nell'area segreteria (l'area cliente non viene toccata)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-sg",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm",
  display: "swap",
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${spaceGrotesk.variable} ${dmSans.variable}`}>{children}</div>;
}
