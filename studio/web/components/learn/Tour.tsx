"use client";

import { useState } from "react";
import { KeyRound, Upload, Layers, Play, BarChart3, Compass } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const STEPS = [
  { icon: KeyRound, title: "Bring your own key", body: "Add your OpenRouter API key from the header, then pick any model. The key stays in your browser tab, is never stored or logged, and requests carry no app attribution. You only spend on the runs you trigger." },
  { icon: Upload, title: "Load a corpus", body: "In the Playground, paste or upload documents — or hit “Load sample” to start instantly. RAG Atlas shows exactly how it chunks them." },
  { icon: Layers, title: "Pick strategies", body: "Choose any mix of the seven RAG and non-RAG strategies. Each card explains what it does, when it shines, and where it struggles." },
  { icon: Play, title: "Run & watch", body: "Ask a question and watch each strategy retrieve and reason live — side by side, with real cost and latency as it streams." },
  { icon: BarChart3, title: "Compare, evaluate, decide", body: "Compare answers, grade strategies on gold answers in Evaluate, profile cost, and get a domain-aware recommendation. Everything’s saved to History." },
];

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  function finish() {
    setStep(0);
    onClose();
  }

  return (
    <Modal open={open} onClose={finish} maxWidth={460}>
      <div className="flex flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-[16px] bg-accent-soft text-accent">
          <Icon className="h-7 w-7" />
        </span>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
          {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-2 font-display text-[26px] leading-tight tracking-tightest">{s.title}</h2>
        <p className="mt-3 max-w-[40ch] text-[14px] leading-relaxed text-ink-muted">{s.body}</p>

        {/* progress dots */}
        <div className="mt-6 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-pill transition-all ${i === step ? "w-5 bg-ink" : "w-1.5 bg-ink/20"}`}
            />
          ))}
        </div>

        <div className="mt-7 flex w-full items-center justify-between">
          <Button variant="quiet" size="sm" onClick={finish}>
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((x) => x - 1)}>
                Back
              </Button>
            )}
            {last ? (
              <Button size="sm" leftIcon={<Compass className="h-4 w-4" />} onClick={finish}>
                Start exploring
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((x) => x + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
