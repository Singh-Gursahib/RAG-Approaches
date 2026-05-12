import type { Metadata } from "next";
import { Fraunces, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "RAG_Ureap — Long-context strategy comparison",
  description:
    "Seven retrieval and non-retrieval strategies, compared head-to-head on a hand-authored eval set with bootstrap 95% CIs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen">
        <div className="relative z-10">
          <Header />
          <main className="mx-auto max-w-[1320px] px-6 sm:px-10 lg:px-14 pb-32">{children}</main>
          <footer className="mt-32 border-t border-border">
            <div className="mx-auto max-w-[1320px] px-6 sm:px-10 lg:px-14 py-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
              <div>
                <p className="font-display text-lg text-ink tracking-tightest">RAG_Ureap</p>
                <p className="text-sm text-ink-muted mt-1">
                  A reproducible comparison of long-context strategies. Built phase by phase.
                </p>
              </div>
              <p className="text-xs text-ink-faint font-mono uppercase tracking-widest">
                gemini-3-flash-preview · single seed · N=34
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
