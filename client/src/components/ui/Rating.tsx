import { useI18n } from "../../i18n/useI18n";
import type { RatingInfo } from "../../lib/api";

export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const { t } = useI18n();
  const full = Math.round(value);
  return (
    <span role="img" aria-label={t("rating.outOf", { value })} className={`text-amber-500 ${className}`}>
      {"★".repeat(full)}
      <span className="text-slate-300">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export function RatingBadge({ info }: { info?: RatingInfo }) {
  const { t } = useI18n();
  if (!info || info.count === 0) return <span className="text-xs text-slate-500">{t("rating.new")}</span>;
  return (
    <span className="text-sm text-slate-700">
      <span className="text-amber-500">★</span> {info.average.toFixed(1)}{" "}
      <span className="text-slate-500">({info.count})</span>
    </span>
  );
}