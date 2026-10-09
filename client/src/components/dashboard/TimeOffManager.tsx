import { useEffect, useState, type FormEvent } from "react";
import { addTimeOff, deleteTimeOff, getProviderMe, type TimeOff } from "../../lib/api";

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", dateStyle: "medium" });

function todayInAddis(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function describe(t: TimeOff): string {
  const first = dateFmt.format(new Date(t.startAt));
  const last = dateFmt.format(new Date(new Date(t.endAt).getTime() - 60 * 1000));
  return first === last ? first : `${first} → ${last}`;
}

export default function TimeOffManager() {
  const [items, setItems] = useState<TimeOff[] | null>(null);
  const [startDate, setStartDate] = useState(todayInAddis);
  const [endDate, setEndDate] = useState(todayInAddis);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getProviderMe()
      .then((me) => setItems(me.timeOff))
      .catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (endDate < startDate) {
      setError("Last day must be on or after the first day");
      return;
    }
    setSubmitting(true);
    try {
      // ሙሉ ቀን፦ ከመጀመሪያው ቀን 00:00 እስከ የመጨረሻው ቀን ማግስት 00:00 (የአዲስ አበባ ሰዓት)
      const startAt = new Date(`${startDate}T00:00:00+03:00`).toISOString();
      const endAt = new Date(new Date(`${endDate}T00:00:00+03:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
      const created = await addTimeOff({ startAt, endAt, reason: reason.trim() || undefined });
      setItems((list) =>
        [...(list ?? []), created].sort((a, b) => a.startAt.localeCompare(b.startAt)),
      );
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add time off");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    setError("");
    try {
      await deleteTimeOff(id);
      setItems((list) => list?.filter((t) => t.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="font-medium text-gray-900">Add time off</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-600">
            From
            <input
              type="date"
              required
              min={todayInAddis()}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block rounded-lg border border-gray-300 p-2"
            />
          </label>
          <label className="text-sm text-gray-600">
            To (inclusive)
            <input
              type="date"
              required
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block rounded-lg border border-gray-300 p-2"
            />
          </label>
          <input
            placeholder="Reason (optional)"
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-w-48 flex-1 rounded-lg border border-gray-300 p-2"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!items && !error && <p className="mt-4 text-gray-500">Loading...</p>}
      {items?.length === 0 && <p className="mt-4 text-gray-600">No upcoming time off.</p>}

      <ul className="mt-4 space-y-2">
        {items?.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3">
            <div>
              <p className="text-gray-900">{describe(t)}</p>
              {t.reason && <p className="text-sm text-gray-500">{t.reason}</p>}
            </div>
            <button onClick={() => onDelete(t.id)} className="text-sm text-red-600 hover:underline">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}