import { useI18n } from "../../i18n/useI18n";

interface Point {
  date: string;
  bookings: number;
  cancelled: number;
}

export default function BarChart({ data }: { data: Point[] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...data.map((d) => d.bookings + d.cancelled));

  return (
    <div>
      <div className="flex h-40 items-end gap-px" role="img" aria-label={t("adm.chart.label")}>
        {data.map((d) => (
          <div
            key={d.date}
            title={t("adm.chart.tip", { date: d.date, booked: d.bookings, cancelled: d.cancelled })}
            className="flex h-full flex-1 flex-col justify-end"
          >
            <div className="bg-red-300" style={{ height: `${(d.cancelled / max) * 100}%` }} />
            <div className="bg-brand-700" style={{ height: `${(d.bookings / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-gray-500">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 bg-brand-700" /> {t("adm.chart.booked")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 bg-red-300" /> {t("adm.chart.cancelled")}
        </span>
      </div>
    </div>
  );
}