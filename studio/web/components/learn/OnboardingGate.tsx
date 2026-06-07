"use client";

import { useEffect, useState } from "react";
import { Tour } from "./Tour";
import { Glossary } from "./Glossary";
import { ensureStarterConfigs } from "@/lib/store";

const ONBOARDED = "rag-atlas:onboarded";

/**
 * Mounted once in the layout. Seeds starter configs, auto-launches the tour on
 * first visit, and opens the Tour / Glossary in response to global events so any
 * component (e.g. the header help menu) can trigger them.
 */
export function OnboardingGate() {
  const [tour, setTour] = useState(false);
  const [glossary, setGlossary] = useState(false);

  useEffect(() => {
    ensureStarterConfigs();

    // First-visit auto tour.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!localStorage.getItem(ONBOARDED)) {
        timer = setTimeout(() => setTour(true), 700);
      }
    } catch {
      /* ignore */
    }

    const startTour = () => setTour(true);
    const openGlossary = () => setGlossary(true);
    window.addEventListener("rag-atlas:start-tour", startTour);
    window.addEventListener("rag-atlas:open-glossary", openGlossary);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("rag-atlas:start-tour", startTour);
      window.removeEventListener("rag-atlas:open-glossary", openGlossary);
    };
  }, []);

  function closeTour() {
    setTour(false);
    try {
      localStorage.setItem(ONBOARDED, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <Tour open={tour} onClose={closeTour} />
      <Glossary open={glossary} onClose={() => setGlossary(false)} />
    </>
  );
}
