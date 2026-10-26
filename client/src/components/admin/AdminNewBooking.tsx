import { useEffect, useState, type FormEvent } from "react";
import { createAdminBooking, getAvailability, getProviders, type Provider, type Slot } from "../../lib/api";
import { useI18n } from "../../i18n/useI18n";
import { timeWithLocal } from "../../i18n/format";

const todayInAddis = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const maxDateInAddis = () =>
  new Date(Date.now() + 3 * 60 * 60 * 1000 + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default function AdminNewBooking() {
  const { t, locale } = useI18n();
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [providerId, setProviderId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [date, setDate] = useState(todayInAddis);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getProviders()
      .then(setProviders)
      .catch((e) => setError(e.message));
  }, []);

  const provider = providers?.find((p) => p.id === providerId) ?? null;
  const services = provider?.services ?? [];
  const styles = (provider?.variants ?? []).filter((v) => v.serviceId === serviceId);
  const needsStyle = styles.length > 0;
  const ready = Boolean(provider && serviceId && date && (!needsStyle || styleId));

  useEffect(() => {
    if (!provider || !ready) return;
    let cancelled = false;
    getAvailability(provider.id, serviceId, date, needsStyle ? styleId : undefined)
      .then((a) => {
        if (!cancelled) setSlots(a.slots);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
        setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, ready, serviceId, styleId, date, needsStyle, refreshKey]);

  function reset() {
    setSlots(null);
    setSelected(null);
    setError("");
    setNotice("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!provider || !selected) {
      setError(t("mb.pickTime"));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await createAdminBooking({
        providerId: provider.id,
        customerName: name,
        customerPhone: phone,
        serviceId,
        variantId: needsStyle ? styleId : undefined,
        startAt: selected.start,
        notes: notes.trim() || undefined,
      });
      setNotice(t("adm.nb.saved", { name, time: timeWithLocal(locale, selected.label) }));
      // ቀጣዩን ደንበኛ ለማስገባት ባለሙያውና ቀኑ ይቆያሉ
      setName("");
      setPhone("");
      setNotes("");
      setSelected(null);
      setSlots(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("mb.errSave"));
      setSelected(null);
      setSlots(null);
      setRefreshKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-gray-300 bg-white p-2 text-sm";

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="font-medium text-gray-900">{t("mb.title")}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <select
          required
          value={providerId}
          onChange={(e) => {
            setProviderId(e.target.value);
            setServiceId("");
            setStyleId("");
            reset();
          }}
          className={`${input} sm:col-span-2`}
        >
          <option value="">{t("adm.nb.chooseSpecialist")}</option>
          {providers?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <input required minLength={2} placeholder={t("mb.namePh")} value={name} onChange={(e) => setName(e.target.value)} className={input} />
        <input required placeholder={t("mb.phonePh")} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />

        <select
          required
          disabled={!provider}
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setStyleId("");
            reset();
          }}
          className={input}
        >
          <option value="">{t("mb.chooseService")}</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {needsStyle && (
          <select
            required
            value={styleId}
            onChange={(e) => {
              setStyleId(e.target.value);
              reset();
            }}
            className={input}
          >
            <option value="">{t("mb.chooseStyle")}</option>
            {styles.map((v) => (
              <option key={v.id} value={v.id}>
                {t("mb.styleOption", { name: v.name, price: v.price, minutes: v.durationMinutes })}
              </option>
            ))}
          </select>
        )}

        <input
          type="date"
          required
          value={date}
          min={todayInAddis()}
          max={maxDateInAddis()}
          onChange={(e) => {
            if (!e.target.value) return;
            setDate(e.target.value);
            reset();
          }}
          className={input}
        />
      </div>

      {ready && slots === null && <p className="mt-3 text-sm text-gray-500">{t("mb.loadingTimes")}</p>}
      {slots?.length === 0 && <p className="mt-3 text-sm text-gray-600">{t("mb.noTimes")}</p>}
      {slots && slots.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {slots.map((s) => (
            <button
              type="button"
              key={s.start}
              onClick={() => setSelected(s)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                selected?.start === s.start
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-gray-300 bg-white hover:border-brand-600"
              }`}
            >
            {timeWithLocal(locale, s.label)}
            </button>
          ))}
        </div>
      )}

      <textarea
        placeholder={t("mb.notesPh")}
        maxLength={500}
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className={`${input} mt-3`}
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-2 text-sm text-green-700">{notice}</p>}

      <button
        type="submit"
        disabled={busy || !selected}
        className="mt-3 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {busy ? t("mb.saving") : t("mb.save")}
      </button>
    </form>
  );
}