type AiSummaryCardProps = {
  summary: string;
  disclaimer: string;
};

export function AiSummaryCard({ summary, disclaimer }: AiSummaryCardProps) {
  return (
    <div className="rounded-lg border border-border bg-bg-primary p-6 shadow-sm">
      <h2 className="text-h3 font-semibold text-text-primary">AI Summary</h2>

      <p className="mt-4 text-body-md text-text-primary">{summary}</p>

      <p className="mt-4 text-caption text-text-secondary">{disclaimer}</p>

      <button
        type="button"
        className="mt-4 w-full rounded-md border border-border px-4 py-2 text-body-md font-medium text-text-primary transition-colors hover:bg-surface"
      >
        Provide Feedback
      </button>
    </div>
  );
}
