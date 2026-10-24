import { useEffect, useState } from "react";
import { getProviderMe, saveWorkingHours, type WorkingWindow } from "../../lib/api";
import { useI18n } from "../../i18n/useI18n";

const DAYS = [
  { value: 1, labelKey: "day.1" },
  { value: 2, labelKey: "day.2" },
  { value: 3, labelKey: "day.3" },
  { value: 4, labelKey: "day.4" },
  { value: 5, labelKey: "day.5" },
  { value: 6, labelKey: "day.6" },
  { value: 0, labelKey: "day.0" },
] as const;

export default function WorkingHoursEditor() {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t("wh.errSave"));
    } finally {
      setSaving(false);
    }
  }

  if (!windows) {
    return error ? <p className="text-red-600">{error}</p> : <p className="text-gray-500">{t("common.loading")}</p>;
  }

  return (
    <div>
      <p className="text-sm text-gray-600">{t("wh.help")}</p>

      <div className="mt-4 space-y-3">
        {DAYS.map((d) => {
          const rows = windows.map((w, i) => ({ w, i })).filter(({ w }) => w.dayOfWeek === d.value);
          return (
            <div key={d.value} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">{t(d.labelKey)}</p>
                <button onClick={() => add(d.value)} className="text-sm text-gray-700 underline">
                  {t("wh.addHours")}
                </button>
              </div>
              {rows.length === 0 && <p className="mt-2 text-sm text-gray-500">{t("wh.dayOff")}</p>}
              {rows.map(({ w, i }) => (
                <div key={i} className="mt-2 flex items-center gap-2">
                  <input
                    type="time"
                    value={w.startTime}
                    onChange={(e) => update(i, { startTime: e.target.value })}
                    className="rounded-lg border border-gray-300 p-1"
                  />
                  <span className="text-gray-500">{t("wh.to")}</span>
                  <input
                    type="time"
                    value={w.endTime}
                    onChange={(e) => update(i, { endTime: e.target.value })}
                    className="rounded-lg border border-gray-300 p-1"
                  />
                  <button onClick={() => remove(i)} className="ml-2 text-sm text-red-600 hover:underline">
                    {t("common.remove")}
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
          className="rounded-lg bg-brand-700 px-4 py-2 text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {saving ? t("wh.saving") : t("wh.save")}
        </button>
        {saved && <span className="text-sm text-green-700">{t("wh.saved")}</span>}
      </div>
    </div>
  );
}