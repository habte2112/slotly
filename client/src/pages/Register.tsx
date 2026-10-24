import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { useI18n } from "../i18n/useI18n";

export default function Register() {
  const { t } = useI18n();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signUp({ name, email, phone: phone.trim() || undefined, password });
      navigate(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-gray-900">{t("auth.register.title")}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          required
          placeholder={t("auth.fullName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        <input
          type="email"
          required
          placeholder={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        <input
          placeholder={t("auth.phoneOptional")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder={t("auth.passwordMin")}
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
          {submitting ? t("auth.register.submitting") : t("nav.signUp")}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="font-medium text-gray-900 underline">
          {t("nav.logIn")}
        </Link>
      </p>
    </div>
  );
}