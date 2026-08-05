import type { SentimentLabel } from "@/lib/sample-articles";

export function SentimentBadge({ sentimentLabel }: { sentimentLabel: SentimentLabel }) {
  const label = sentimentLabel.charAt(0).toUpperCase() + sentimentLabel.slice(1);

  return (
    <span className="rounded-full border border-border px-3 py-1 text-caption text-text-secondary">
      {label}
    </span>
  );
}
