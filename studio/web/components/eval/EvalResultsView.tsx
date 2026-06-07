"use client";

import dynamic from "next/dynamic";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { Skeleton } from "@/components/ui/Skeleton";
import { Leaderboard } from "./Leaderboard";
import { SignificanceTable } from "./SignificanceTable";
import { HallucinationPanel } from "./HallucinationPanel";
import { QuestionExplorer } from "./QuestionExplorer";
import { ForestPlot } from "@/components/viz/ForestPlot";
import { WinLossMatrix } from "@/components/viz/WinLossMatrix";
import { exportCSV, exportJSON } from "@/lib/export";
import type { EvalResults } from "@/lib/types";

// recharts is heavy — load it on demand so it stays out of the initial bundle.
const ProbeRadar = dynamic(() => import("@/components/viz/ProbeRadar").then((m) => m.ProbeRadar), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full" />,
});

/** The full scored results dashboard, shared by /evaluate and /replay. */
export function EvalResultsView({
  results,
  metric,
  setMetric,
  showExport = true,
}: {
  results: EvalResults;
  metric: "em" | "f1";
  setMetric: (m: "em" | "f1") => void;
  showExport?: boolean;
}) {
  const forestRows = results.headline.map((h) => ({
    approach: h.approach,
    value: metric === "f1" ? h.f1 : h.em,
    lo: metric === "f1" ? h.f1_lo : h.em_lo,
    hi: metric === "f1" ? h.f1_hi : h.em_hi,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[28px] tracking-tightest">Results</h2>
        <div className="flex items-center gap-2">
          <Segmented
            options={[{ value: "f1", label: "F1" }, { value: "em", label: "EM" }]}
            value={metric}
            onChange={setMetric}
          />
          {showExport && (
            <>
              <Button size="sm" variant="ghost" leftIcon={<Download className="h-4 w-4" />} onClick={() => exportJSON(results)}>
                JSON
              </Button>
              <Button size="sm" variant="ghost" leftIcon={<Download className="h-4 w-4" />} onClick={() => exportCSV(results)}>
                CSV
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        <p className="eyebrow mb-4">Leaderboard</p>
        <Leaderboard rows={results.headline} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <p className="eyebrow mb-4">{metric.toUpperCase()} with 95% confidence interval</p>
          <ForestPlot rows={forestRows} />
        </Card>
        <Card className="p-5 sm:p-6">
          <p className="eyebrow mb-2">Per-probe {metric.toUpperCase()}</p>
          <ProbeRadar rows={results.per_probe} approaches={results.approaches} metric={metric} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <p className="eyebrow mb-4">Head-to-head wins (by correctness)</p>
          <WinLossMatrix approaches={results.approaches} matrix={results.win_matrix} />
        </Card>
        <Card className="p-5 sm:p-6">
          <p className="eyebrow mb-4">Statistical significance · {metric.toUpperCase()}</p>
          <SignificanceTable
            approaches={results.approaches}
            matrix={metric === "f1" ? results.pairwise_f1 : results.pairwise_em}
          />
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <p className="eyebrow mb-4">Refusal honesty</p>
        <HallucinationPanel rows={results.per_probe} approaches={results.approaches} />
      </Card>

      <Card className="p-5 sm:p-6">
        <p className="eyebrow mb-4">Every question, every strategy</p>
        <QuestionExplorer questions={results.questions} approaches={results.approaches} />
      </Card>
    </div>
  );
}
