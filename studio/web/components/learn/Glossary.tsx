"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Compass } from "lucide-react";

const TERMS: { term: string; def: string }[] = [
  { term: "RAG", def: "Retrieval-Augmented Generation — fetch relevant text from your corpus and give it to the model as context, instead of relying on its memory." },
  { term: "Chunking", def: "Splitting documents into smaller passages so retrieval can pick the most relevant pieces. Chunk size and overlap trade precision against context." },
  { term: "Embedding", def: "A numeric vector capturing a passage's meaning. Similar meanings sit close together, which is how vector search finds relevant chunks." },
  { term: "top-k", def: "How many chunks are retrieved and handed to the model. Larger k = more context but more noise and cost." },
  { term: "BM25", def: "A classic keyword-ranking algorithm. Strong at exact terms, codes, and names that vector search can miss." },
  { term: "RRF", def: "Reciprocal Rank Fusion — a simple way to blend two ranked lists (e.g. keyword + vector) into one." },
  { term: "Reranker", def: "A cross-encoder that re-scores candidate chunks against the question, rescuing relevant ones that ranked low at first." },
  { term: "HyDE", def: "Hypothetical Document Embeddings — the model drafts an imagined answer, which is embedded and used to retrieve better-matching chunks." },
  { term: "EM", def: "Exact Match — 1 if the answer matches the gold answer exactly (after normalization), else 0. Strict; penalizes verbose-but-correct answers." },
  { term: "F1", def: "Token-overlap score giving partial credit. The better headline metric for short factoid answers, since it captures 'mostly right'." },
  { term: "Bootstrap CI", def: "A confidence interval estimated by resampling. Wide intervals at small N are honest — they show how much the score could shift." },
  { term: "Probe types", def: "Categories of test question: needle (one buried fact), multi-hop (chain facts), distractor (lookalike traps), hallucination (deliberately absent), sanity (trivial)." },
  { term: "Refusal honesty", def: "How often a strategy correctly says 'not in the corpus' instead of fabricating. Critical where a wrong answer is worse than none." },
];

export function Glossary({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Glossary" maxWidth={560}>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {TERMS.map((t) => (
          <div key={t.term} className="rounded-[12px] border border-line bg-canvas/40 p-3.5">
            <p className="text-[13px] font-medium text-ink">{t.term}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{t.def}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between">
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Compass className="h-4 w-4" />}
          onClick={() => {
            onClose();
            window.dispatchEvent(new Event("rag-atlas:start-tour"));
          }}
        >
          Take the product tour
        </Button>
        <Button size="sm" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
