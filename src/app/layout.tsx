import type { Metadata } from "next";
import { Inter, Newsreader, JetBrains_Mono, Caveat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hook AI",
  applicationName: "Hook AI",
  description:
    "Hook AI. Signale aus dem Rauschen. Daily Feed für Builder.",
  appleWebApp: {
    capable: true,
    title: "Hook AI",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${newsreader.variable} ${jetbrains.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-radar-page text-radar-ink">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
