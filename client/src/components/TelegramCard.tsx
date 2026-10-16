import { useEffect, useState } from "react";
import { createTelegramLink, getTelegramStatus, unlinkTelegram, type TelegramStatus } from "../lib/api";

export default function TelegramCard() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getTelegramStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // link ክፍት ሲሆን በየ 3 ሰከንዱ ውይይቱ መገናኘቱን ይፈትሻል
  useEffect(() => {
    if (!linkUrl) return;
    const poll = setInterval(() => {
      getTelegramStatus()
        .then((s) => {
          if (s.linked) {
            setStatus(s);
            setLinkUrl("");
          }
        })
        .catch(() => {});
    }, 3000);
    const expire = setTimeout(() => setLinkUrl(""), 15 * 60 * 1000);
    return () => {
      clearInterval(poll);
      clearTimeout(expire);
    };
  }, [linkUrl]);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      setLinkUrl(await createTelegramLink());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the link");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      await unlinkTelegram();
      setStatus((s) => s && { ...s, linked: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setBusy(false);
    }
  }

  // ባህሪው ካልተዋቀረ ምንም አይታይም
  if (!status?.enabled) return null;

  return (
    <section className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
          <path d="M21 4 3 11l6 2 2 6 3-4 5 3L21 4Z" strokeLinejoin="round" />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        {status.linked ? (
          <>
            <p className="font-semibold text-slate-900">Telegram is connected ✓</p>
            <p className="text-sm text-slate-600">
              Booking updates and reminders arrive in your chat. Send /bookings to the bot to see your appointments.
            </p>
          </>
        ) : linkUrl ? (
          <>
            <p className="font-semibold text-slate-900">Almost there</p>
            <p className="text-sm text-slate-600">
              Open Telegram and tap Start. This page updates by itself. The link works once and expires in 15 minutes.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-slate-900">Get booking updates on Telegram</p>
            <p className="text-sm text-slate-600">Confirmations and reminders in your chat, plus cancel from the bot.</p>
          </>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

      {status.linked ? (
        <button
          onClick={disconnect}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Disconnect
        </button>
      ) : linkUrl ? (
        <a
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          Open Telegram
        </a>
      ) : (
        <button
          onClick={connect}
          disabled={busy}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {busy ? "Preparing..." : "Connect Telegram"}
        </button>
      )}
    </section>
  );
}