import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import clsx from "clsx";
import "./globals.css";
import { Header } from "@/components/shell/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { OnboardingGate } from "@/components/learn/OnboardingGate";
import { FooterHelp } from "@/components/shell/FooterHelp";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "RAG Atlas — find the right retrieval strategy for your corpus",
  description:
    "Live-test seven RAG and non-RAG strategies on your own documents with your own Gemini key. Compare answers, cost, latency, and hallucination risk — then get a domain-aware recommendation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={clsx(GeistSans.variable, jetbrains.variable)}>
      <body className="min-h-screen">
        <ToastProvider>
          <div className="grain" aria-hidden />
          <div className="relative z-10 flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <OnboardingGate />
        </ToastProvider>
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-line">
      <div className="shell py-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          {/* brand */}
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-[9px] bg-ink text-canvas">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.2 9.4 6.6 14.8 8 9.4 9.4 8 14.8 6.6 9.4 1.2 8 6.6 6.6 8 1.2Z" fill="currentColor" />
                </svg>
              </span>
              <span className="font-display text-[18px] font-medium tracking-tightest">RAG Atlas</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
              Test retrieval strategies live on your own documents — an interactive companion to the
              RAG_Ureap research framework.
            </p>
          </div>

          {/* links + trust */}
          <div className="flex flex-col gap-4 md:items-end">
            <FooterHelp />
            <p className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-approach-rerank" />
              Your key stays in your browser — never uploaded, never logged.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-5 font-mono text-[11.5px] text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 RAG Atlas</span>
          <span>Built on the RAG_Ureap framework · Apache-2.0</span>
        </div>
      </div>
    </footer>
  );
}
