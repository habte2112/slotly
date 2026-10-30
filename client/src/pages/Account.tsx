import { useState, type FormEvent } from "react";
import { useAuth } from "../context/auth-context";
import { useI18n } from "../i18n/useI18n";
import { changePassword } from "../lib/api";

export default function Account() {
  const { user } = useAuth();
  const { t } = useI18n();

  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);
    if (password !== confirm) {
      setError(t("auth.reset.mismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(current, password);
      setCurrent("");
      setPassword("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-gray-900">{t("acc.title")}</h1>
      {user && (
        <p className="mt-2 text-sm text-gray-600">
          {user.name} · {user.email}
        </p>
      )}

      <h2 className="mt-8 text-lg font-semibold text-gray-900">{t("acc.pwTitle")}</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder={t("acc.current")}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder={t("acc.new")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder={t("acc.repeat")}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {done && <p className="text-sm text-green-700">{t("acc.done")}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-700 p-2 text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {submitting ? t("acc.submitting") : t("acc.submit")}
        </button>
      </form>
    </div>
  );
}