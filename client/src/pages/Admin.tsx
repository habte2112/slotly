import { useState } from "react";
import Overview from "../components/admin/Overview";
import AdminBookings from "../components/admin/AdminBookings";
import AdminServices from "../components/admin/AdminServices";
import AdminProviders from "../components/admin/AdminProviders";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "bookings", label: "Bookings" },
  { id: "services", label: "Services" },
  { id: "specialists", label: "Specialists" },
] as const;

export default function Admin() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900">Admin</h1>

      <div className="mt-4 flex gap-2 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              tab === t.id
                ? "border-brand-700 font-medium text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <Overview />}
        {tab === "bookings" && <AdminBookings />}
        {tab === "services" && <AdminServices />}
        {tab === "specialists" && <AdminProviders />}
      </div>
    </>
  );
}