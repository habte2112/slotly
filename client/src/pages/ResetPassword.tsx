import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/useI18n";
import { resetPassword } from "../lib/api";

export default function ResetPassword() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("auth.reset.mismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">{t("auth.reset.invalidTitle")}</h1>
        <p className="mt-3 text-gray-600">{t("auth.reset.missingToken")}</p>
        <Link to="/forgot-password" className="mt-4 inline-block text-sm font-medium text-gray-900 underline">
          {t("auth.reset.requestNew")}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">{t("auth.reset.doneTitle")}</h1>
        <p className="mt-3 text-gray-600">{t("auth.reset.doneText")}</p>
        <Link to="/login" className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-white hover:bg-brand-800">
          {t("nav.logIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-gray-900">{t("auth.reset.title")}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="password"
          required
          minLength={8}
          placeholder={t("auth.reset.newPh")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder={t("auth.reset.repeatPh")}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        {error && (
          <p className="text-sm text-red-600">
            {error}{" "}
            {error === t("err.resetInvalid") && (
              <Link to="/forgot-password" className="underline">
                {t("auth.reset.requestNew")}
              </Link>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-700 p-2 text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {submitting ? t("auth.reset.submitting") : t("auth.reset.submit")}
        </button>
      </form>
    </div>
  );
}