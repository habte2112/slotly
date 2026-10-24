import { useEffect, useState } from "react";
import { createTelegramLink, getTelegramStatus, unlinkTelegram, type TelegramStatus } from "../lib/api";
import { useI18n } from "../i18n/useI18n";

export default function TelegramCard() {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t("tg.errLink"));
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
      setError(err instanceof Error ? err.message : t("tg.errDisconnect"));
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
            <p className="font-semibold text-slate-900">{t("tg.connected")}</p>
            <p className="text-sm text-slate-600">{t("tg.connectedDesc")}</p>
          </>
        ) : linkUrl ? (
          <>
            <p className="font-semibold text-slate-900">{t("tg.almost")}</p>
            <p className="text-sm text-slate-600">{t("tg.almostDesc")}</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-slate-900">{t("tg.getUpdates")}</p>
            <p className="text-sm text-slate-600">{t("tg.getUpdatesDesc")}</p>
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
          {t("tg.disconnect")}
        </button>
      ) : linkUrl ? (
        <a
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          {t("tg.open")}
        </a>
      ) : (
        <button
          onClick={connect}
          disabled={busy}
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {busy ? t("tg.preparing") : t("tg.connect")}
        </button>
      )}
    </section>
  );
}