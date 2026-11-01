import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { useI18n } from "../i18n/useI18n";

// ዲሞ ላይ ብቻ፤ ሁሉም ይፋ የዲሞ መለያዎች ናቸው (በ seed ውስጥ ያሉ)
const IS_DEMO = import.meta.env.VITE_DEMO !== "false";
const DEMO_ACCOUNTS = [
  { label: "auth.demo.customer", email: "CUSTOMER_EMAIL", password: "CUSTOMER_PASSWORD", to: "/" },
  { label: "auth.demo.specialist", email: "selam@slotly.dev", password: "Provider123", to: "/dashboard" },
  { label: "auth.demo.admin", email: "ADMIN_EMAIL", password: "ADMIN_PASSWORD", to: "/admin" },
] as const;

export default function Login() {
  const { t } = useI18n();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function demoLogin(account: (typeof DEMO_ACCOUNTS)[number]) {
    setError("");
    setSubmitting(true);
    try {
      await signIn(account.email, account.password);
      navigate(account.to);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-gray-900">{t("nav.logIn")}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="email"
          required
          placeholder={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        <input
          type="password"
          required
          placeholder={t("auth.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-700 p-2 text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {submitting ? t("auth.login.submitting") : t("nav.logIn")}
        </button>
      </form>
      <p className="mt-3 text-sm">
        <Link to="/forgot-password" className="text-gray-600 underline">
          {t("auth.forgotLink")}
        </Link>
      </p>
      <p className="mt-4 text-sm text-gray-600">
        {t("auth.noAccount")}{" "}
        <Link to="/register" className="font-medium text-gray-900 underline">
          {t("nav.signUp")}
        </Link>
      </p>
      {IS_DEMO && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">{t("auth.demo.title")}</p>
          <p className="mt-1 text-xs text-gray-600">{t("auth.demo.hint")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.label}
                type="button"
                disabled={submitting}
                onClick={() => demoLogin(a)}
                className="rounded-lg border border-brand-700 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {t(a.label)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}