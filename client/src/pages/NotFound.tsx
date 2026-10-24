import { Link } from "react-router-dom";
import { useI18n } from "../i18n/useI18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="py-16 text-center">
      <p className="text-5xl font-bold text-brand-700">404</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">{t("nf.title")}</h1>
      <p className="mt-2 text-slate-600">{t("nf.text")}</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-800"
      >
        {t("nf.back")}
      </Link>
    </div>
  );
}