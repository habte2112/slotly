import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../lib/api";

export default function ResetPassword() {
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
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Invalid link</h1>
        <p className="mt-3 text-gray-600">This reset link is missing its token.</p>
        <Link to="/forgot-password" className="mt-4 inline-block text-sm font-medium text-gray-900 underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Password updated</h1>
        <p className="mt-3 text-gray-600">You can now log in with your new password.</p>
        <Link to="/login" className="mt-4 inline-block rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-700">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-gray-900">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="password"
          required
          minLength={8}
          placeholder="New password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Repeat new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-gray-300 p-2"
        />
        {error && (
          <p className="text-sm text-red-600">
            {error}{" "}
            {error.includes("expired") && (
              <Link to="/forgot-password" className="underline">
                Request a new link
              </Link>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gray-900 p-2 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Update password"}
        </button>
      </form>
    </div>
  );
}