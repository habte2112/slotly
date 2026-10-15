import { useState } from "react";
import ProviderBookings from "../components/dashboard/ProviderBookings";
import WorkingHoursEditor from "../components/dashboard/WorkingHoursEditor";
import TimeOffManager from "../components/dashboard/TimeOffManager";

const TABS = [
  { id: "bookings", label: "Bookings" },
  { id: "hours", label: "Working hours" },
  { id: "timeoff", label: "Time off" },
] as const;

export default function Dashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("bookings");

  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === t.id ? "border-brand-700 font-medium text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.label}
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