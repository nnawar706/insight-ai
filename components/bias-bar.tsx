type BiasBarProps = {
  leftPercentage: number;
  centerPercentage: number;
  rightPercentage: number;
};

export function BiasBar({ leftPercentage, centerPercentage, rightPercentage }: BiasBarProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-2 overflow-hidden rounded-full">
        <div className="bg-bias-left" style={{ width: `${leftPercentage}%` }} />
        <div className="bg-bias-center" style={{ width: `${centerPercentage}%` }} />
        <div className="bg-bias-right" style={{ width: `${rightPercentage}%` }} />
      </div>
      <div className="flex items-center justify-between text-caption">
        <span className="text-bias-left font-medium">L {leftPercentage}%</span>
        <span className="text-text-secondary">Center {centerPercentage}%</span>
        <span className="text-bias-right font-medium">Right {rightPercentage}%</span>
      </div>
    </div>
  );
}
