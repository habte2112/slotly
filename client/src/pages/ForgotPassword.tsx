import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/useI18n";
import { forgotPassword } from "../lib/api";

export default function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">{t("auth.forgot.checkTitle")}</h1>
        <p className="mt-3 text-gray-600">
          {t("auth.forgot.sentBefore")}
          <span className="font-medium">{email}</span>
          {t("auth.forgot.sentAfter")}
        </p>
        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-gray-900 underline">
          {t("auth.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-gray-900">{t("auth.forgotLink")}</h1>
      <p className="mt-2 text-sm text-gray-600">{t("auth.forgot.intro")}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="email"
          required
          placeholder={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-700 p-2 text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {submitting ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
        </button>
      </form>
      <Link to="/login" className="mt-4 inline-block text-sm text-gray-600 underline">
        {t("auth.backToLogin")}
      </Link>
    </div>
  );
}