type FramingNotesCardProps = {
  framingNotes: string;
  loadedTerms: string[];
};

export function FramingNotesCard({ framingNotes, loadedTerms }: FramingNotesCardProps) {
  return (
    <div className="rounded-lg border border-border bg-bg-primary p-6 shadow-sm">
      <h2 className="text-h3 font-semibold text-text-primary">Framing Notes</h2>

      <p className="mt-4 text-body-md text-text-primary">{framingNotes}</p>

      <p className="mt-4 text-body-sm text-text-secondary">Loaded Terms</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {loadedTerms.map((term) => (
          <span
            key={term}
            className="rounded-full border border-border bg-surface px-3 py-1 text-caption text-text-secondary"
          >
            {term}
          </span>
        ))}
      </div>
    </div>
  );
}
