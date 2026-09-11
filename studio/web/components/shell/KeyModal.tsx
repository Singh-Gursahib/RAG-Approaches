"use client";

import { useState } from "react";
import { ExternalLink, ShieldCheck, KeyRound, Trash2, CheckCircle2, XCircle, Server } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { fmtUSD } from "@/lib/format";
import { clearKey, getKey, maskKey, setKey } from "@/lib/key";
import { useKey } from "@/lib/useKey";

export function KeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { key, browserKey, serverKey } = useKey();
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const toast = useToast();

  async function handleSave() {
    const value = draft.trim();
    if (!value) return;
    setKey(value);
    setDraft("");
    setResult(null);
    toast("API key saved for this browser session.", "success");
  }

  async function handleTest() {
    // Save first if a draft is present, otherwise test the stored (or server) key.
    if (draft.trim()) setKey(draft.trim());
    if (!getKey() && !serverKey) {
      setResult({ ok: false, message: "Enter a key first." });
      return;
    }
    setChecking(true);
    setResult(null);
    try {
      const r = await api.checkKey();
      if (r.ok) {
        const who = r.source === "server" ? "The server key" : "Your key";
        const limit = r.limit_remaining != null ? ` ${fmtUSD(r.limit_remaining, 2)} of its credit limit left.` : "";
        setResult({ ok: true, message: `${who} is valid.${r.is_free_tier ? " Free tier." : ""}${limit}` });
        setDraft("");
        toast("Key verified.", "success");
      } else {
        setResult({ ok: false, message: r.message || "Key check failed." });
      }
    } catch (e) {
      setResult({ ok: false, message: (e as Error).message });
    } finally {
      setChecking(false);
    }
  }

  function handleClear() {
    clearKey();
    setDraft("");
    setResult(null);
    toast("API key cleared from this browser.", "info");
  }

  return (
    <Modal open={open} onClose={onClose} title="Your OpenRouter API key" maxWidth={480}>
      <div className="flex flex-col gap-4">
        {browserKey && (
          <div className="flex items-center justify-between rounded-[12px] bg-ink/[0.04] px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-[13px] text-ink">
              <KeyRound className="h-4 w-4 text-approach-rerank" />
              <span className="font-mono">{maskKey(key ?? "")}</span>
            </span>
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1 text-[12.5px] text-ink-muted hover:text-approach-recursive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        )}

        {serverKey && !browserKey && (
          <div className="flex items-start gap-2 rounded-[12px] bg-approach-rerank/[0.07] px-3.5 py-3">
            <Server className="mt-0.5 h-4 w-4 shrink-0 text-approach-rerank" />
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              This install has a <span className="text-ink">server-side key</span> (OPENROUTER_API_KEY in the
              repo&apos;s .env), so runs work without entering one. Add your own key below to use it instead.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Input
            type="password"
            autoComplete="off"
            placeholder={browserKey ? "Paste a new key to replace…" : "sk-or-v1-…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            aria-label="OpenRouter API key"
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!draft.trim()} size="sm">
              Save key
            </Button>
            <Button onClick={handleTest} variant="ghost" size="sm" loading={checking}>
              Test key
            </Button>
          </div>
        </div>

        {result && (
          <div
            className={`flex items-center gap-2 rounded-[10px] px-3 py-2 text-[12.5px] ${
              result.ok
                ? "bg-approach-rerank/10 text-approach-rerank"
                : "bg-approach-recursive/10 text-approach-recursive"
            }`}
          >
            {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <span>{result.message}</span>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-[12px] border border-line bg-canvas/60 px-3.5 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-approach-rerank" />
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            Your key is stored only in this browser tab and sent with each request to run a model. It is{" "}
            <span className="text-ink">never written to disk, logged, or sent back</span> by the server.
            Model calls go from the server straight to OpenRouter with{" "}
            <span className="text-ink">no app name or referrer attached</span>, so they are not attributed to
            this app. Testing a key is free.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline"
          >
            Create an OpenRouter API key <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://openrouter.ai/models"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline"
          >
            Browse models <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </Modal>
  );
}
