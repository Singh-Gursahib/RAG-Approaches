import type { DocIn } from "./types";

// A tiny, self-contained sample corpus so first-time users can run something in
// one click. Planted facts mirror the research corpus's style (needles, a
// multi-hop chain, a deliberately-absent fact for the hallucination probe).
export const SAMPLE_CORPUS: DocIn[] = [
  {
    doc_id: "halden_institute",
    text: `The Halden Institute was founded in 1991 in the coastal town of Brey. It employs 178 staff members across four research wings. The institute's archive password for the 2019 Constanin papers is MULBERRY-7Q. The Institute's director, Mei-Ling Forrester, joined in 2014. The Halden Institute funds the MERIDIAN-7 satellite programme through its Applied Optics wing.`,
  },
  {
    doc_id: "city_of_veridian",
    text: `The city of Veridian sits on the Auralite river. Its municipal water system contains a chlorination ratio of 0.46 ppm at point of distribution. Veridian was incorporated in 1991 and is home to the Crescent Bridge, completed in 1998. The city hosts the Halden Institute on its eastern edge.`,
  },
  {
    doc_id: "meridian7_satellite",
    text: `The MERIDIAN-7 satellite is assigned the internal designator M7-RX-204-A. It transmits telemetry at a frequency of 2.2 GHz. MERIDIAN-7 was launched on 9 April 2019. Its primary instrument is a hyperspectral imager built by the Applied Optics wing of its funding institute.`,
  },
];

export interface SampleQuestion {
  question: string;
  type: string;
  note: string;
}

export const SAMPLE_QUESTIONS: SampleQuestion[] = [
  { question: "What is the Halden Institute's archive password for the 2019 Constanin papers?", type: "needle", note: "A single planted fact." },
  { question: "Who funds the MERIDIAN-7 satellite, and in which city is that funder located?", type: "multi_hop", note: "Chains across two documents." },
  { question: "What year was Veridian incorporated?", type: "sanity", note: "A trivially-answerable fact." },
  { question: "What is the annual budget of the Halden Institute?", type: "hallucination", note: "Deliberately absent — a good approach should refuse." },
];

// For eval flows: sample questions WITH gold answers.
export const SAMPLE_EVAL: { question: string; gold_answer: string; type: string }[] = [
  { question: "What is the Halden Institute's archive password for the 2019 Constanin papers?", gold_answer: "MULBERRY-7Q", type: "needle" },
  { question: "What is the MERIDIAN-7 internal designator?", gold_answer: "M7-RX-204-A", type: "needle" },
  { question: "Who funds the MERIDIAN-7 satellite, and in which city is that funder located?", gold_answer: "The Halden Institute, in Veridian", type: "multi_hop" },
  { question: "What year was Veridian incorporated?", gold_answer: "1991", type: "sanity" },
  { question: "What is the chlorination ratio of Veridian's water system?", gold_answer: "0.46 ppm", type: "needle" },
  { question: "What is the annual budget of the Halden Institute?", gold_answer: "NOT_IN_CONTEXT", type: "hallucination" },
];
