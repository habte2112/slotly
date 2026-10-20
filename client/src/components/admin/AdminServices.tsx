import { useEffect, useState, type FormEvent } from "react";
import {
  createService,
  createStyle,
  getAdminServices,
  updateService,
  updateStyle,
  type AdminService,
  type AdminStyle,
} from "../../lib/api";

function StyleRow({
  style,
  onChange,
  onError,
}: {
  style: AdminStyle;
  onChange: (s: AdminStyle) => void;
  onError: (message: string) => void;
}) {
  async function toggle() {
    try {
      onChange({ ...style, ...(await updateStyle(style.id, { isActive: !style.isActive })) });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update style");
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 text-sm">
      <span className={style.isActive ? "text-slate-900" : "text-slate-400 line-through"}>
        {style.name} · {style.durationMinutes} min · {style.price} ETB
        {!style.isActive && " (hidden)"}
      </span>
      <button onClick={toggle} className="rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-100">
        {style.isActive ? "Hide" : "Show"}
      </button>
    </li>
  );
}

function AddStyle({ service, onAdded }: { service: AdminService; onAdded: (s: AdminStyle) => void }) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { variant } = await createStyle(service.id, {
        name,
        durationMinutes: Number(duration),
        price: Number(price),
      });
      onAdded(variant);
      setName("");
      setPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add style");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
      <input
        required
        minLength={2}
        placeholder="New style name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-w-40 flex-1 rounded-lg border border-slate-300 p-2 text-sm"
      />
      <input
        type="number"
        required
        min={5}
        max={480}
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        aria-label="Duration in minutes"
        className="w-24 rounded-lg border border-slate-300 p-2 text-sm"
      />
      <input
        type="number"
        required
        min={0}
        placeholder="ETB"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        aria-label="Price in ETB"
        className="w-28 rounded-lg border border-slate-300 p-2 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {busy ? "Adding..." : "Add style"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

export default function AdminServices() {
  const [services, setServices] = useState<AdminService[] | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getAdminServices()
      .then(setServices)
      .catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const created = await createService({
        name,
        description: description.trim() || undefined,
        durationMinutes: Number(duration),
        price: Number(price),
      });
      setServices((list) =>
        [...(list ?? []), { ...created, variants: [] }].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setName("");
      setDescription("");
      setPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create service");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(service: AdminService) {
    setError("");
    try {
      const updated = await updateService(service.id, { isActive: !service.isActive });
      setServices((list) => list?.map((s) => (s.id === service.id ? { ...s, ...updated } : s)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update service");
    }
  }

  function replaceStyle(serviceId: string, next: AdminStyle) {
    setServices(
      (list) =>
        list?.map((s) => (s.id === serviceId ? { ...s, variants: s.variants.map((v) => (v.id === next.id ? next : v)) } : s)) ??
        null,
    );
  }

  function addStyle(serviceId: string, style: AdminStyle) {
    setServices((list) => list?.map((s) => (s.id === serviceId ? { ...s, variants: [...s.variants, style] } : s)) ?? null);
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="font-medium text-gray-900">Add a service</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            required
            minLength={2}
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-gray-300 p-2"
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg border border-gray-300 p-2"
          />
          <label className="text-sm text-gray-600">
            Duration (minutes, 5-480)
            <input
              type="number"
              required
              min={5}
              max={480}
              step={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
            />
          </label>
          <label className="text-sm text-gray-600">
            Price (ETB)
            <input
              type="number"
              required
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-3 rounded-lg bg-brand-700 px-4 py-2 text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add service"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!services && !error && <p className="mt-4 text-gray-500">Loading...</p>}

      <ul className="mt-4 space-y-3">
        {services?.map((s) => (
          <li key={s.id} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-medium ${s.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>{s.name}</p>
                <p className="text-sm text-gray-500">
                  {s.durationMinutes} min · {s.price} ETB {s.isActive ? "" : "· hidden from customers"}
                </p>
              </div>
              <button
                onClick={() => toggle(s)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
              >
                {s.isActive ? "Hide" : "Show"}
              </button>
            </div>

            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Styles ({s.variants.length})
            </p>
            <ul>
              {s.variants.map((v) => (
                <StyleRow key={v.id} style={v} onChange={(next) => replaceStyle(s.id, next)} onError={setError} />
              ))}
            </ul>
            <AddStyle service={s} onAdded={(style) => addStyle(s.id, style)} />
          </li>
        ))}
      </ul>
    </div>
  );
}