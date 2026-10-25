import { useEffect, useState } from "react";
import { getAdminReviews, setReviewHidden, type AdminReview } from "../../lib/api";
import { Stars } from "../ui/Rating";
import { useI18n } from "../../i18n/useI18n";

export default function AdminReviews() {
  const { t } = useI18n();
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminReviews()
      .then(setReviews)
      .catch((e) => setError(e.message));
  }, []);

  async function toggle(r: AdminReview) {
    setError("");
    try {
      await setReviewHidden(r.id, !r.isHidden);
      setReviews((list) => list?.map((x) => (x.id === r.id ? { ...x, isHidden: !r.isHidden } : x)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adm.rv.updateFailed"));
    }
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!reviews && !error && <p className="text-gray-500">{t("adm.loading")}</p>}
      {reviews?.length === 0 && <p className="text-gray-500">{t("adm.rv.none")}</p>}
      <ul className="space-y-3">
        {reviews?.map((r) => (
          <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Stars value={r.rating} />
                <span className="ml-2 text-sm text-gray-600">
                  {t("adm.rv.meta", {
                    provider: r.provider.user.name,
                    customer: r.customer.name,
                    email: r.customer.email,
                  })}
                </span>
              </div>
              <button
                onClick={() => toggle(r)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
              >
                {r.isHidden ? t("adm.rv.show") : t("adm.rv.hide")}
              </button>
            </div>
            {r.comment && (
              <p className={`mt-2 text-sm ${r.isHidden ? "text-gray-400 line-through" : "text-gray-800"}`}>
                {r.comment}
              </p>
            )}
            {r.isHidden && <p className="mt-1 text-xs text-gray-500">{t("adm.rv.hidden")}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}