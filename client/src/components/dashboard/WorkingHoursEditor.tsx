import { useEffect, useState } from "react";
import { getProviderMe, saveWorkingHours, type WorkingWindow } from "../../lib/api";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

export default function WorkingHoursEditor() {
  const [windows, setWindows] = useState<WorkingWindow[] | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProviderMe()
      .then((me) => setWindows(me.workingHours))
      .catch((e) => setError(e.message));
  }, []);

  function update(index: number, patch: Partial<WorkingWindow>) {
    setWindows((list) => list?.map((w, i) => (i === index ? { ...w, ...patch } : w)) ?? null);
    setSaved(false);
  }

  function add(day: number) {
    setWindows((list) => [...(list ?? []), { dayOfWeek: day, startTime: "08:00", endTime: "17:00" }]);
    setSaved(false);
  }

  function remove(index: number) {
    setWindows((list) => list?.filter((_, i) => i !== index) ?? null);
    setSaved(false);
  }

  async function save() {
    if (!windows) return;
    setSaving(true);
    setError("");
    try {
      await saveWorkingHours(windows);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (!windows) return error ? <p className="text-red-600">{error}</p> : <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <p className="text-sm text-gray-600">
        Add more than one time range per day for a break (for example 08:00-12:00 and 13:00-17:00). Existing bookings
        are not affected.
      </p>

      <div className="mt-4 space-y-3">
        {DAYS.map((d) => {
          const rows = windows.map((w, i) => ({ w, i })).filter(({ w }) => w.dayOfWeek === d.value);
          return (
            <div key={d.value} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">{d.label}</p>
                <button onClick={() => add(d.value)} className="text-sm text-gray-700 underline">
                  + Add hours
                </button>
              </div>
              {rows.length === 0 && <p className="mt-2 text-sm text-gray-500">Day off</p>}
              {rows.map(({ w, i }) => (
                <div key={i} className="mt-2 flex items-center gap-2">
                  <input
                    type="time"
                    value={w.startTime}
                    onChange={(e) => update(i, { startTime: e.target.value })}
                    className="rounded-lg border border-gray-300 p-1"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="time"
                    value={w.endTime}
                    onChange={(e) => update(i, { endTime: e.target.value })}
                    className="rounded-lg border border-gray-300 p-1"
                  />
                  <button onClick={() => remove(i)} className="ml-2 text-sm text-red-600 hover:underline">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save working hours"}
        </button>
        {saved && <span className="text-sm text-green-700">Saved</span>}
      </div>
    </div>
  );
}