import { useEffect, useState, type FormEvent } from "react";
import {
  createProviderByEmail,
  getAdminProviders,
  getAdminServices,
  setProviderServices,
  setProviderStyles,
  type AdminProvider,
  type AdminService,
} from "../../lib/api";

type Row = { on: boolean; price: string; minutes: string };

function rowsFor(p: AdminProvider): Record<string, Row> {
  return Object.fromEntries(
    p.variants.map((v) => [
      v.variantId,
      { on: true, price: v.priceOverride?.toString() ?? "", minutes: v.durationOverride?.toString() ?? "" },
    ]),
  );
}

export default function AdminProviders() {
  const [providers, setProviders] = useState<AdminProvider[] | null>(null);
  const [services, setServices] = useState<AdminService[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [styles, setStyles] = useState<Record<string, Record<string, Row>>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAdminProviders(), getAdminServices()])
      .then(([provs, svcs]) => {
        if (cancelled) return;
        setProviders(provs);
        setServices(svcs);
        setSelected(Object.fromEntries(provs.map((p) => [p.id, p.services.map((s) => s.id)])));
        setStyles(Object.fromEntries(provs.map((p) => [p.id, rowsFor(p)])));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function toggleService(providerId: string, serviceId: string) {
    setNotice("");
    setSelected((cur) => {
      const list = cur[providerId] ?? [];
      return {
        ...cur,
        [providerId]: list.includes(serviceId) ? list.filter((id) => id !== serviceId) : [...list, serviceId],
      };
    });
  }

  function patchRow(providerId: string, variantId: string, patch: Partial<Row>) {
    setNotice("");
    setStyles((cur) => {
      const rows = cur[providerId] ?? {};
      const row = rows[variantId] ?? { on: false, price: "", minutes: "" };
      return { ...cur, [providerId]: { ...rows, [variantId]: { ...row, ...patch } } };
    });
  }

  async function save(providerId: string) {
    setError("");
    setNotice("");
    setSavingId(providerId);
    try {
      const serviceIds = selected[providerId] ?? [];
      // ዘይቤዎቹ በባለሙያው አገልግሎቶች ብቻ ይወሰናሉ
      const allowed = new Set(
        services.filter((s) => serviceIds.includes(s.id)).flatMap((s) => s.variants.map((v) => v.id)),
      );
      const variants = Object.entries(styles[providerId] ?? {})
        .filter(([variantId, row]) => row.on && allowed.has(variantId))
        .map(([variantId, row]) => ({
          variantId,
          priceOverride: row.price.trim() === "" ? null : Number(row.price),
          durationOverride: row.minutes.trim() === "" ? null : Number(row.minutes),
        }));

      await setProviderServices(providerId, serviceIds);
      await setProviderStyles(providerId, variants);
      setNotice("Saved");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingId("");
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setAdding(true);
    try {
      await createProviderByEmail(email, bio.trim() || undefined);
      setNotice("Specialist added. They must log out and log in again to see their dashboard.");
      setEmail("");
      setBio("");
      setProviders(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add specialist");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <form onSubmit={onAdd} className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="font-medium text-gray-900">Add a specialist</p>
        <p className="mt-1 text-sm text-gray-500">The person must already have a customer account.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <input
            type="email"
            required
            placeholder="Email of an existing user"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-56 flex-1 rounded-lg border border-gray-300 p-2"
          />
          <input
            placeholder="Short bio (optional)"
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="min-w-56 flex-1 rounded-lg border border-gray-300 p-2"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-brand-700 px-4 py-2 text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {notice && <p className="mt-4 text-sm text-green-700">{notice}</p>}
      {!providers && !error && <p className="mt-4 text-gray-500">Loading...</p>}

      <ul className="mt-4 space-y-3">
        {providers?.map((p) => (
          <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="font-medium text-gray-900">{p.name}</p>
            <p className="text-sm text-gray-500">{p.email}</p>
            {p.bio && <p className="mt-1 text-sm text-gray-600">{p.bio}</p>}

            <p className="mt-3 text-sm font-medium text-gray-700">Services offered</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={(selected[p.id] ?? []).includes(s.id)}
                    onChange={() => toggleService(p.id, s.id)}
                  />
                  {s.name}
                  {!s.isActive && <span className="text-xs text-gray-400">(hidden)</span>}
                </label>
              ))}
            </div>

            {services
              .filter((s) => (selected[p.id] ?? []).includes(s.id) && s.variants.length > 0)
              .map((s) => (
                <div key={s.id} className="mt-4">
                  <p className="text-sm font-medium text-gray-700">{s.name}: styles and own prices</p>
                  <p className="text-xs text-gray-500">Leave price and minutes empty to use the style's defaults.</p>
                  <ul className="mt-2 space-y-2">
                    {s.variants.map((v) => {
                      const row = styles[p.id]?.[v.id] ?? { on: false, price: "", minutes: "" };
                      return (
                        <li key={v.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <label className="flex min-w-48 items-center gap-2 text-gray-800">
                            <input
                              type="checkbox"
                              checked={row.on}
                              onChange={(e) => patchRow(p.id, v.id, { on: e.target.checked })}
                            />
                            {v.name}
                            {!v.isActive && <span className="text-xs text-gray-400">(hidden)</span>}
                          </label>
                          <input
                            type="number"
                            min={0}
                            disabled={!row.on}
                            placeholder={`${v.price} ETB`}
                            value={row.price}
                            onChange={(e) => patchRow(p.id, v.id, { price: e.target.value })}
                            aria-label={`${v.name} price`}
                            className="w-28 rounded-lg border border-gray-300 p-1.5 disabled:bg-gray-100"
                          />
                          <input
                            type="number"
                            min={5}
                            max={480}
                            disabled={!row.on}
                            placeholder={`${v.durationMinutes} min`}
                            value={row.minutes}
                            onChange={(e) => patchRow(p.id, v.id, { minutes: e.target.value })}
                            aria-label={`${v.name} minutes`}
                            className="w-28 rounded-lg border border-gray-300 p-1.5 disabled:bg-gray-100"
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

            <button
              onClick={() => save(p.id)}
              disabled={savingId === p.id}
              className="mt-4 rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              {savingId === p.id ? "Saving..." : "Save"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}