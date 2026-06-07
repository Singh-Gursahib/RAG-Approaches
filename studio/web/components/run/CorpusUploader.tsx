"use client";

import { useCallback, useRef, useState } from "react";
import { FileText, Upload, Sparkles, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Slider } from "@/components/ui/Controls";
import { HelpPopover } from "@/components/ui/Tooltip";
import { Tag } from "@/components/ui/Tag";
import { api, ApiError } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import { SAMPLE_CORPUS } from "@/lib/samples";
import type { ChunkConfig, CorpusStats, DocIn } from "@/lib/types";

export interface CorpusState {
  documents: DocIn[];
  chunking: ChunkConfig;
  stats: CorpusStats | null;
  label: string;
}

export function CorpusUploader({
  value,
  onChange,
}: {
  value: CorpusState;
  onChange: (next: CorpusState) => void;
}) {
  const [text, setText] = useState(() =>
    value.documents.map((d) => d.text).join("\n\n---\n\n"),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshPreview = useCallback(
    async (documents: DocIn[], chunking: ChunkConfig, label: string) => {
      if (!documents.length) {
        onChange({ documents, chunking, stats: null, label });
        return;
      }
      setBusy(true);
      setErr(null);
      try {
        const res = await api.corpusPreview(documents, chunking);
        onChange({ documents, chunking, stats: res.stats, label });
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : String(e));
        onChange({ documents, chunking, stats: null, label });
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  function docsFromText(raw: string): DocIn[] {
    // Split on a "---" separator line into multiple docs; else one doc.
    const parts = raw
      .split(/\n\s*---\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.map((p, i) => ({ doc_id: `doc_${i + 1}`, text: p }));
  }

  function handleApplyText() {
    const docs = docsFromText(text);
    refreshPreview(docs, value.chunking, docs.length > 1 ? `${docs.length} documents` : "1 document");
  }

  function handleSample() {
    setText(SAMPLE_CORPUS.map((d) => d.text).join("\n\n---\n\n"));
    refreshPreview(SAMPLE_CORPUS, value.chunking, "Sample corpus");
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const docs: DocIn[] = [];
    for (const f of Array.from(files)) {
      const t = await f.text();
      docs.push({ doc_id: f.name.replace(/\.[^.]+$/, ""), text: t });
    }
    setText(docs.map((d) => d.text).join("\n\n---\n\n"));
    refreshPreview(docs, value.chunking, `${docs.length} file${docs.length > 1 ? "s" : ""}`);
  }

  function handleChunkChange(next: Partial<ChunkConfig>) {
    const chunking = { ...value.chunking, ...next };
    if (value.documents.length) refreshPreview(value.documents, chunking, value.label);
    else onChange({ ...value, chunking });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => e.preventDefault()}
        className="relative"
      >
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your documents here. Separate multiple documents with a line containing only ---"
          className="font-mono text-[13px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleApplyText} disabled={!text.trim()} loading={busy}>
          Use this corpus
        </Button>
        <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()} leftIcon={<Upload className="h-4 w-4" />}>
          Upload files
        </Button>
        <Button size="sm" variant="quiet" onClick={handleSample} leftIcon={<Sparkles className="h-4 w-4" />}>
          Load sample
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {err && <p className="text-[13px] text-approach-recursive">{err}</p>}

      {/* Chunking controls + live preview */}
      <div className="grid gap-5 rounded-card border border-line bg-canvas/40 p-4 sm:grid-cols-2">
        <Slider
          label="Chunk size"
          suffix="tokens"
          value={value.chunking.target_tokens}
          min={40}
          max={400}
          step={10}
          onChange={(v) => handleChunkChange({ target_tokens: v })}
          hint={<HelpPopover>How big each retrieval unit is. Smaller = more precise, more chunks.</HelpPopover>}
        />
        <Slider
          label="Overlap"
          suffix="tokens"
          value={value.chunking.overlap_tokens}
          min={0}
          max={Math.max(0, value.chunking.target_tokens - 10)}
          step={5}
          onChange={(v) => handleChunkChange({ overlap_tokens: v })}
          hint={<HelpPopover>Shared text between adjacent chunks so facts aren’t split at a boundary.</HelpPopover>}
        />
      </div>

      {value.stats && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-muted">
          <Tag tone="neutral">
            <FileText className="h-3 w-3" /> {value.stats.n_docs} docs
          </Tag>
          <Tag tone="neutral">
            <Layers className="h-3 w-3" /> {value.stats.n_chunks} chunks
          </Tag>
          <span className="font-mono">≈ {fmtInt(value.stats.est_tokens)} tokens</span>
        </div>
      )}
    </div>
  );
}
