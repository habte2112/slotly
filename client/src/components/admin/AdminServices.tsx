import { useEffect, useState, type FormEvent } from "react";
import { createService, getAdminServices, updateService, type AdminService } from "../../lib/api";

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
      setServices((list) => [...(list ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
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
      setServices((list) => list?.map((s) => (s.id === service.id ? updated : s)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update service");
    }
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

      <ul className="mt-4 space-y-2">
        {services?.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
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
          </li>
        ))}
      </ul>
    </div>
  );
}