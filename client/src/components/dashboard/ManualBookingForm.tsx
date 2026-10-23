import { useEffect, useState, type FormEvent } from "react";
import {
  createManualBooking,
  getAvailability,
  getProviderMe,
  getProviders,
  type Provider,
  type Slot,
} from "../../lib/api";

const todayInAddis = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const maxDateInAddis = () =>
  new Date(Date.now() + 3 * 60 * 60 * 1000 + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default function ManualBookingForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [me, setMe] = useState<Provider | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [date, setDate] = useState(todayInAddis);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getProviderMe(), getProviders()])
      .then(([mine, list]) => {
        if (!cancelled) setMe(list.find((p) => p.id === mine.provider.id) ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const services = me?.services ?? [];
  const styles = (me?.variants ?? []).filter((v) => v.serviceId === serviceId);
  const needsStyle = styles.length > 0;
  const ready = Boolean(me && serviceId && date && (!needsStyle || styleId));

  useEffect(() => {
    if (!me || !ready) return;
    let cancelled = false;
    getAvailability(me.id, serviceId, date, needsStyle ? styleId : undefined)
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
  }, [me, ready, serviceId, styleId, date, needsStyle, refreshKey]);

  function reset() {
    setSlots(null);
    setSelected(null);
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Please pick a time");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createManualBooking({
        customerName: name,
        customerPhone: phone,
        serviceId,
        variantId: needsStyle ? styleId : undefined,
        startAt: selected.start,
        notes: notes.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the booking");
      setSelected(null);
      setSlots(null);
      setRefreshKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-gray-300 bg-white p-2 text-sm";

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium text-gray-900">Add a booking for a phone or walk-in customer</p>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900">
          Close
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input required minLength={2} placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        <input required placeholder="Phone (09...)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />

        <select
          required
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setStyleId("");
            reset();
          }}
          className={input}
        >
          <option value="">Choose a service</option>
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
            <option value="">Choose a style</option>
            {styles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.price} ETB · {v.durationMinutes} min
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

      {ready && slots === null && <p className="mt-3 text-sm text-gray-500">Loading times...</p>}
      {slots?.length === 0 && <p className="mt-3 text-sm text-gray-600">No free times on this day.</p>}
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
              {s.label}
            </button>
          ))}
        </div>
      )}

      <textarea
        placeholder="Notes (optional)"
        maxLength={500}
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className={`${input} mt-3`}
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy || !selected}
        className="mt-3 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save booking"}
      </button>
    </form>
  );
}