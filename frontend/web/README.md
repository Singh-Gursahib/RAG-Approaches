# RAG_Ureap Dashboard

A Next.js 15 dashboard for exploring the experimental results. Apple-clean light theme, generous whitespace, Fraunces + Geist typography, custom data-viz palette per approach.

## Pages

| Path | Purpose |
|---|---|
| `/` | Overview: hero, top-metric cards, leaderboard with bootstrap CIs, Pareto chart, per-probe radar, six findings |
| `/pareto` | Interactive Pareto frontier (EM/F1 toggle), per-approach cards |
| `/compare` | Side-by-side approach toggles, win-loss matrix, per-question diff |
| `/approaches/[name]` | Per-approach deep dive: headline metrics with CIs, forest plots, probe breakdown, every prediction |

## Setup

From the project root:

```bash
# 1. (Once) regenerate the data.json from runs/
.venv/bin/python scripts/build_dashboard_data.py

# 2. Install deps and launch
cd frontend/web
npm install
npm run dev
```

Open <http://localhost:3000>.

After adding new experimental runs, re-run the Python data builder and refresh the browser.

## Architecture

- **Build-time data**: `scripts/build_dashboard_data.py` aggregates everything under `runs/<id>/` into `frontend/web/lib/data.json`, which every page imports directly. No server, no API routes — the dashboard is fully static and reproducible from a git commit.
- **Charts**: Recharts (Pareto scatter, radar) plus hand-built CSS forest plots and win-loss heatmap for full visual control.
- **Theming**: Tailwind `tailwind.config.ts` defines `approach-*` colors mapped to each technique. The CSS variables in `globals.css` carry the typography + grain texture.

## Adding a new approach

1. Add the implementation to `src/ragureap/approaches/<name>.py` and register it in `runner.py`.
2. Add a key to the `ApproachKey` type in `frontend/web/lib/types.ts`.
3. Add an entry to `APPROACH_COLOR`, `APPROACH_LABEL`, `APPROACH_FAMILY`, `APPROACH_TAGLINE` in `frontend/web/lib/colors.ts`.
4. Add the new `<name>` to the `APPROACHES` array in `frontend/web/app/approaches/[name]/page.tsx` and `frontend/web/app/compare/page.tsx`.
5. Run an experiment with the new approach and regenerate `data.json`.
