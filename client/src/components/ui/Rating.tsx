import type { RatingInfo } from "../../lib/api";

export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span role="img" aria-label={`${value} out of 5`} className={`text-amber-500 ${className}`}>
      {"★".repeat(full)}
      <span className="text-slate-300">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export function RatingBadge({ info }: { info?: RatingInfo }) {
  if (!info || info.count === 0) return <span className="text-xs text-slate-500">New</span>;
  return (
    <span className="text-sm text-slate-700">
      <span className="text-amber-500">★</span> {info.average.toFixed(1)}{" "}
      <span className="text-slate-500">({info.count})</span>
    </span>
  );
}