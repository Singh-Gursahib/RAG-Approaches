# 07 — Datasets & Domain Corpora

> Per-domain corpus sources, ingestion pipelines, ground-truth construction, and licensing. Every domain has a `DomainAdapter` that wraps a pinned, versioned dataset.

---

## 1. Design Goals

1. **Every domain runs every technique.** A domain is "ready" when it has (a) raw documents, (b) processed chunks, (c) a benchmark Q&A set with ground truth, (d) a prompt pack.
2. **Open licenses preferred.** No corpus enters the repo unless licensing permits redistribution or there is a documented in-place download path.
3. **Pinned versions.** Every dataset has a `dataset_hash` (sha256 over canonical content) recorded in run manifests. Updates bump the hash and create a parallel snapshot rather than overwriting.
4. **Synthetic where necessary.** When licensing or labor cost prevents real ground truth, synthesize Q&A via LLM with a documented protocol + spot-check.
5. **Three corpus sizes.** Each domain ships **small** (~100 docs / smoke), **medium** (~1K docs / phase 12 main), and an optional **large** (~10K+ docs / stress) tier.

---

## 2. Per-Domain Corpora

### 2.1 Legal

**Sources.**
- **CourtListener** (RECAP) US case law — public, downloadable via API. Subset of cases by jurisdiction + year.
- **EUR-Lex** EU regulations + directives — open, structured XML.
- **CUAD** (Contract Understanding Atticus Dataset) — 510 contracts with annotated clauses.
- **CaseHOLD** — multiple-choice case-holding identification (built-in benchmark).
- **Sample contracts** from public template repositories (NDA, employment, lease).

**Tiers.**
- Small (100): 50 CUAD contracts + 30 EUR-Lex regs + 20 SCOTUS cases.
- Medium (1K): 500 CUAD + 300 EUR-Lex + 200 federal cases.
- Large (10K): full CUAD + full EUR-Lex regulations subset.

**Distinctive challenges.** Citation networks (case → case), precise clause wording, archaic phrasing, multi-language (EUR-Lex available in 24 EU languages — keep English).

**Benchmark targets.**
- Single-clause lookup ("What is the indemnification clause in contract X?").
- Multi-hop reasoning ("Which contracts have indemnification incompatible with statute Y?").
- Citation traversal ("List all cases citing Marbury v. Madison's holding on judicial review").
- Adversarial: contradictory clauses across documents; near-duplicate clauses with subtle differences.

**License.** CourtListener public-domain (US gov work); EUR-Lex open data; CUAD CC-BY 4.0.

---

### 2.2 Medical / Biomedical

**Sources.**
- **PubMed Central Open Access** (PMC OA) — full-text papers, ~5M articles, NCBI XML.
- **MIMIC-IV** clinical notes — restricted (requires DUA); fall back to **MIMIC-III demo** subset (publicly available, ~100 patients).
- **WHO clinical guidelines** (open).
- **MedQA / MedMCQA** — public medical multiple-choice benchmarks (built-in ground truth).
- **PubMedQA** — yes/no/maybe biomedical QA dataset.

**Tiers.**
- Small (100): 80 PMC OA papers in oncology + 20 WHO guideline excerpts.
- Medium (1K): 800 PMC papers spanning oncology / cardiology / infectious disease + 200 WHO + ICD-coded condition pages.
- Large: full PMC OA in two specialties.

**Distinctive challenges.** Acronym density, dose / measurement precision, citation chains, lay-vs-clinical vocabulary mismatch (HyDE candidate).

**Benchmark targets.**
- Drug dosage lookup (precision-critical).
- Differential diagnosis from symptom set (multi-hop).
- Treatment guideline recall under condition X.
- Adversarial: contradictory recommendations across guideline versions; safety-edge cases (paediatric vs adult dosing).

**License.** PMC OA varies (mostly CC-BY); we filter to redistributable subsets. MedQA / MedMCQA publicly released. MIMIC requires user-supplied DUA → optional.

---

### 2.3 Education

**Sources.**
- **OpenStax** textbooks (CC-BY) — biology, physics, history, economics.
- **Khan Academy** (transcripts where licensed; curriculum tags).
- **MIT OpenCourseWare** lecture notes (CC-BY-NC-SA — non-commercial only; flag).
- **Project Gutenberg** classics for literature/history.
- **Squad / Natural Questions** for general comprehension grounding.

**Tiers.**
- Small (100): 5 OpenStax textbooks (~chapters as docs).
- Medium (1K): 20 OpenStax + selected MIT OCW notes.
- Large: 50+ open textbooks across grades.

**Distinctive challenges.** Cross-grade prerequisites (a high-school chem question may need middle-school basics); pedagogical correctness ("explain like I'm 12"); curriculum alignment.

**Benchmark targets.**
- Concept explanation at grade level.
- Worked-example reproduction.
- Cross-chapter prerequisite chains.
- Adversarial: misconceptions (questions phrased with common student mistakes).

**License.** OpenStax CC-BY 4.0; Project Gutenberg public domain.

---

### 2.4 Finance

**Sources.**
- **SEC EDGAR** — 10-K, 10-Q, 8-K filings (public, structured).
- **FinanceBench** — 150 questions over public 10-K filings (released benchmark, ground-truth Q&A).
- **TAT-QA** — financial QA over text + tables.
- **SEC enforcement actions** (public).

**Tiers.**
- Small (100): 50 most-recent 10-K filings of S&P 100 companies + 50 8-K events.
- Medium (1K): 500 10-Ks across sectors + 500 8-Ks.
- Large: full 10-K corpus for selected sector × 10 years.

**Distinctive challenges.** Tabular + narrative interleaving, numerical fidelity, time-sensitivity ("as of fiscal year ended …"), regulatory exact wording.

**Benchmark targets.**
- Financial fact extraction ("What was Apple's net income in FY2024?").
- Cross-filing comparison ("Which S&P 500 companies disclosed climate risk under Item 1A in 2024?").
- Numerical computation grounded in retrieved tables.
- Adversarial: questions whose answer requires a specific filing date (time-sensitivity).

**License.** SEC EDGAR public-domain. FinanceBench CC-BY 4.0. TAT-QA research license.

---

### 2.5 Research / Scientific

**Sources.**
- **arXiv** abstracts + selected full PDFs (open, daily snapshots available).
- **Semantic Scholar Open Research Corpus** — citation graphs.
- **HotpotQA** — Wikipedia-grounded multi-hop QA (clean ground truth).
- **2WikiMultiHopQA** — multi-hop reasoning benchmark.

**Tiers.**
- Small (100): 100 arXiv abstracts (NLP / cs.CL).
- Medium (1K): 1K arXiv full PDFs across cs.CL / cs.LG / cs.AI 2022–2026.
- Large: 10K papers + full Semantic Scholar citation graph subset.

**Distinctive challenges.** Citation networks (GraphRAG candidate), conflicting findings, long surveys, mathematical content, novelty claims.

**Benchmark targets.**
- "What's the SOTA on benchmark X as of date Y?"
- "Which papers contradict the claim in paper Z?"
- "Summarize the line of work descending from paper P."
- Adversarial: hallucinated paper IDs, retracted papers, near-duplicate methods.

**License.** arXiv content is permitted for research use; we redistribute metadata + abstracts and cache PDFs in `data/raw/research/` (gitignored).

---

### 2.6 Code Assistants

**Sources.**
- **The Stack** (BigCode) — permissively-licensed code, ~6TB. Subset used.
- **CodeSearchNet** — code + docstrings across 6 languages.
- **HumanEval / MBPP** — function-level QA benchmarks.
- **SWE-bench** — repository-scale issue/PR pairs (real GitHub bugs).

**Tiers.**
- Small (100): 5 small Python repos (well-known FOSS, ~MIT/Apache).
- Medium (1K): 20 medium repos (10K–100K LOC each).
- Large: SWE-bench-style — 10+ repos with paired issues/PRs.

**Distinctive challenges.** Cross-file dependencies (call graphs), repository-scale context (Full-Context-Injection candidate), structural retrieval (GraphRAG candidate via call/import graphs), exact-syntax recall.

**Benchmark targets.**
- Function definition lookup.
- Cross-file call-chain tracing.
- Bug-fix proposal grounded in issue + repo.
- Adversarial: similarly-named functions in different modules; deprecated API usage.

**License.** The Stack — permissive subset (Apache 2.0, MIT, BSD); HumanEval / MBPP / SWE-bench publicly released.

---

### 2.7 General-Purpose QA

**Sources.**
- **Wikipedia** (English) — full snapshot or curated subset.
- **Natural Questions** — Google search-derived QA grounded in Wikipedia.
- **TriviaQA** — open-domain trivia.
- **MS MARCO** — Bing query / passage / answer triples.

**Tiers.**
- Small (100): 100 Wikipedia articles across diverse topics.
- Medium (1K): 1K Wikipedia articles + Natural Questions test slice.
- Large: KILT — knowledge-intensive language tasks subset.

**Distinctive challenges.** Topic-distribution shift (queries can be anything); short documents; many near-duplicates.

**Benchmark targets.**
- NaturalQuestions test split.
- TriviaQA dev split.
- Adversarial: ambiguous queries, multi-answer queries, time-shifted facts.

**License.** Wikipedia CC-BY-SA. NQ / TriviaQA / MS MARCO publicly released for research.

---

## 3. Ingestion Pipeline

```
data/raw/<domain>/<source>/<files>
    │
    ▼   pipelines/parse/<format>.py    (PDF, HTML, XML, MD, JSON)
Document objects
    │
    ▼   chunking/<strategy>.py
Chunks
    │
    ▼   pipelines/index.py             (per-technique)
Indices in Qdrant / Neo4j / on disk
```

**Parsers.** PDFs via PyMuPDF (preferred over pdfplumber for speed) + a fallback to Marker for academic / scientific PDFs with heavy formulas. HTML via trafilatura. XML via lxml. JSON / JSONL native.

**Chunkers.** Configurable per technique:
- `fixed` — token-count windows, simple.
- `recursive` — LangChain-style recursive char splitter.
- `semantic` — embedding-based boundary detection.
- `document_aware` — uses parsed structure (headings, sections).

**Hashing.** `dataset_hash = sha256( sorted(doc_id, sha256(text)) )` — content-based, stable across machines.

---

## 4. Ground-Truth Construction

For each domain × tier × benchmark, ground truth lives in `data/benchmarks/<domain>/<suite>.jsonl`:

```json
{
  "q_id": "legal-mh-0001",
  "question": "Which CUAD contracts have indemnification clauses incompatible with §2 of the Uniform Commercial Code?",
  "type": "multi_hop",
  "ground_truth": {"answer": "...", "evidence_chunk_ids": ["chk_42", "chk_88"]},
  "difficulty": "hard",
  "tags": ["indemnification", "ucc", "compatibility"],
  "metadata": {"hops": 3, "needs_citation": true}
}
```

Three sources of ground truth:

1. **Built-in benchmarks** (NQ, TriviaQA, FinanceBench, MedQA, HumanEval, HotpotQA). Use as-is, with provenance recorded.
2. **Adapted real ground truth.** Convert existing labels to our schema (CUAD clause spans → multi-clause questions).
3. **Synthetic LLM-generated.** Where no public ground truth exists, generate Q&A with the protocol below.

### 4.1 Synthetic Q&A protocol

```python
for chunk in sampled_chunks(domain, n=500):
    prompt = QGEN_TEMPLATE.format(chunk=chunk.text, type="multi_hop")
    qa = llm.generate(prompt)              # Pro-tier; structured JSON output
    if validator.passes(qa, chunk):        # answer found in chunk; well-formed
        ground_truth.append(qa)
spot_check(ground_truth, n=50)             # human review; reject 10–20% typically
```

Validation rules:
- Answer must be reproducible from the cited evidence chunk (re-prompt LLM, must match).
- Question must not leak the answer literally.
- Hops > 1 → must require ≥2 chunks, verified via second LLM call.
- 10% of synthetic questions are spot-checked by the human reviewer; reject anything ambiguous or wrong.

### 4.2 Human spot-check sub-sample

For each domain we maintain a **100-question human-judged sub-sample** used for:
- Validating automated metrics (correlation with human faithfulness).
- Reporting human-eval numbers in the paper.

The rubric is the structured 0–2 score on faithfulness / completeness / fluency described in `09_EVALUATION.md`.

---

## 5. Test Bank Composition

Each domain produces these benchmark suites:

| Suite | Size | Purpose | Source |
|---|---|---|---|
| `qa.jsonl` | 200–500 | Standard Q&A | Mixed real + synthetic |
| `multihop.jsonl` | 100 | Multi-hop reasoning | Synthesized + adapted |
| `needles.jsonl` | 50 × 5 depths | Needle-in-haystack | Synthesized |
| `adversarial.jsonl` | 100 | Robustness | Synthesized + curated |
| `hallucination.jsonl` | 50 | Out-of-corpus questions | Curated |
| `stress.jsonl` | 20 | Long-context stress (1K → 1M tokens) | Synthesized |

These map directly to the test taxonomies in `08_BENCHMARKING.md`.

---

## 6. Storage Layout

```
data/
├── raw/<domain>/<source>/    # gitignored bulk; manifest committed
│   └── manifest.yaml          # source, fetch date, license, doc count, hash
├── processed/<domain>/
│   ├── chunks.jsonl
│   ├── chunks.dataset_hash
│   ├── embeddings.<embedder>.parquet
│   └── <technique>/           # technique-specific indices
└── benchmarks/<domain>/
    ├── qa.jsonl
    ├── multihop.jsonl
    ├── needles.jsonl
    ├── adversarial.jsonl
    ├── hallucination.jsonl
    └── stress.jsonl
```

The `manifest.yaml` files are committed to git so a contributor can reproduce the data folder by running `make ingest DOMAIN=<x>`.

---

## 7. License Compliance Summary

| Domain | Primary License(s) | Action |
|---|---|---|
| Legal | Public domain (US gov), CC-BY 4.0 (CUAD), EU open data | Redistribute metadata; cache full text in gitignored `data/raw/` |
| Medical | CC-BY (PMC OA), restricted (MIMIC) | DUA-free subset only by default; MIMIC behind a flag |
| Education | CC-BY 4.0, public domain | Redistribute |
| Finance | Public domain (SEC), CC-BY 4.0 (FinanceBench) | Redistribute |
| Research | Open access subsets only | Cache, don't redistribute paywalled |
| Code | Apache/MIT/BSD only | Filter at ingest |
| General | CC-BY-SA (Wikipedia) | Redistribute |

A `LICENSES/` folder ships with per-corpus license files where redistribution applies.

---

## 8. User Inputs Needed (Will Be Re-Asked at End of Phase 0)

- **MIMIC DUA.** Do you have a MIMIC-III/IV credentialed user account? If yes, we can include clinical notes for the medical domain. If no, we use PMC + MedQA only.
- **Proprietary corpora.** Any internal documents you want included (legal contracts, internal wikis, code repos) for a domain we haven't listed?
- **Storage envelope.** Disk available for `data/raw/`? Medium tier across all 7 domains is roughly 30–50 GB.

---

## 9. What Phase 2 Will Deliver

By Phase 2 close:
- One ingestion pipeline (`pipelines/ingest.py`) per domain, end-to-end.
- `data/raw/<domain>/manifest.yaml` for all 7.
- Small-tier corpora downloaded + processed for all 7 domains.
- `data/benchmarks/<domain>/qa.jsonl` (≥100 questions/domain) for all 7.
- Documentation of every dataset's source, license, and hash in `data/README.md`.

Medium-tier acquisition slips into Phase 12 (cross-domain experiments) once the techniques are solid.
