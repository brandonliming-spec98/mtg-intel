import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import PushInit from "@/components/PushInit";

export const metadata: Metadata = {
  title: "MTG Intel — Magic: The Gathering Market Intelligence",
  description: "Real-time MTG card prices, market signals, and intelligence from across the web.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MTG Intel" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="noise min-h-screen">
        <PushInit />
        <NavBar />
        <main className="pb-20 md:pb-0">{children}</main>
      </body>
    </html>
  );
}
