import { useState } from "react";
import ProviderBookings from "../components/dashboard/ProviderBookings";
import WorkingHoursEditor from "../components/dashboard/WorkingHoursEditor";
import TimeOffManager from "../components/dashboard/TimeOffManager";
import { useI18n } from "../i18n/useI18n";

const TABS = [
  { id: "bookings", labelKey: "dash.tab.bookings" },
  { id: "hours", labelKey: "dash.tab.hours" },
  { id: "timeoff", labelKey: "dash.tab.timeoff" },
] as const;

export default function Dashboard() {
  const { t } = useI18n();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("bookings");

  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900">{t("dash.title")}</h1>

      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === tb.id ? "border-brand-700 font-medium text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "bookings" && <ProviderBookings />}
        {tab === "hours" && <WorkingHoursEditor />}
        {tab === "timeoff" && <TimeOffManager />}
      </div>
    </>
  );
}