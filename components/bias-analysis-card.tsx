import { BiasBar } from "./bias-bar";
import type { BiasLabel } from "@/lib/supabase/types";

type BiasAnalysisCardProps = {
  biasLabel: BiasLabel;
  leftPercentage: number;
  centerPercentage: number;
  rightPercentage: number;
  confidence: number;
};

function overallBiasStat(
  biasLabel: BiasLabel,
  leftPercentage: number,
  centerPercentage: number,
  rightPercentage: number,
) {
  const label = biasLabel.charAt(0).toUpperCase() + biasLabel.slice(1);

  if (biasLabel === "left") return { label, percentage: leftPercentage, colorClass: "text-bias-left" };
  if (biasLabel === "right") return { label, percentage: rightPercentage, colorClass: "text-bias-right" };
  if (biasLabel === "center") return { label, percentage: centerPercentage, colorClass: "text-text-primary" };

  return { label, percentage: null, colorClass: "text-text-primary" };
}

export function BiasAnalysisCard({
  biasLabel,
  leftPercentage,
  centerPercentage,
  rightPercentage,
  confidence,
}: BiasAnalysisCardProps) {
  const stat = overallBiasStat(biasLabel, leftPercentage, centerPercentage, rightPercentage);

  return (
    <div className="rounded-lg border border-border bg-bg-primary p-6 shadow-sm">
      <h2 className="text-h3 font-semibold text-text-primary">Bias Analysis</h2>

      <p className="mt-4 text-body-sm text-text-secondary">Overall Bias</p>
      <p className={`text-h1 font-bold ${stat.colorClass}`}>
        {stat.label}
        {stat.percentage !== null ? ` ${stat.percentage}%` : ""}
      </p>

      <div className="mt-4">
        <BiasBar
          leftPercentage={leftPercentage}
          centerPercentage={centerPercentage}
          rightPercentage={rightPercentage}
        />
      </div>

      <p className="mt-4 text-body-sm text-text-secondary">
        Confidence: {Math.round(confidence * 100)}%
      </p>

      <p className="mt-4 text-body-sm text-text-secondary">
        This political framing is AI-estimated based on the article&apos;s text, not objective
        fact.
      </p>

      <button
        type="button"
        className="mt-4 w-full rounded-md border border-border px-4 py-2 text-body-md font-medium text-text-primary transition-colors hover:bg-surface"
      >
        How We Analyze Bias
      </button>
    </div>
  );
}
