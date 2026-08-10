import type { SentimentLabel } from "@/lib/supabase/types";

const SENTIMENT_STYLES: Record<SentimentLabel, string> = {
  positive: "border-sentiment-positive/30 bg-sentiment-positive/10 text-sentiment-positive",
  neutral: "border-sentiment-neutral/30 bg-sentiment-neutral/10 text-sentiment-neutral",
  negative: "border-sentiment-negative/30 bg-sentiment-negative/10 text-sentiment-negative",
};

export function SentimentBadge({ sentimentLabel }: { sentimentLabel: SentimentLabel }) {
  const label = sentimentLabel.charAt(0).toUpperCase() + sentimentLabel.slice(1);

  return (
    <span
      className={`rounded-full border px-3 py-1 text-caption font-medium ${SENTIMENT_STYLES[sentimentLabel]}`}
    >
      {label}
    </span>
  );
}
