import { useState } from "react";
import { useI18n } from "../i18n/useI18n";
import Overview from "../components/admin/Overview";
import AdminBookings from "../components/admin/AdminBookings";
import AdminServices from "../components/admin/AdminServices";
import AdminProviders from "../components/admin/AdminProviders";
import AdminReviews from "../components/admin/AdminReviews";

const TABS = [
  { id: "overview", label: "adm.tab.overview" },
  { id: "bookings", label: "adm.tab.bookings" },
  { id: "services", label: "adm.tab.services" },
  { id: "specialists", label: "adm.tab.specialists" },
  { id: "reviews", label: "adm.tab.reviews" },
] as const;

export default function Admin() {
  const { t } = useI18n();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900">{t("adm.title")}</h1>

      <div className="mt-4 flex gap-2 overflow-x-auto border-b border-gray-200">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              tab === tb.id
                ? "border-brand-700 font-medium text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {t(tb.label)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <Overview />}
        {tab === "bookings" && <AdminBookings />}
        {tab === "services" && <AdminServices />}
        {tab === "specialists" && <AdminProviders />}
        {tab === "reviews" && <AdminReviews />}
      </div>
    </>
  );
}