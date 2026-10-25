import { useEffect, useState, type FormEvent } from "react";
import {
  createService,
  createStyle,
  getAdminServices,
  updateService,
  updateStyle,
  setStyleImage,
  uploadStyleImage,
  type AdminService,
  type AdminStyle,
} from "../../lib/api";
import { useI18n } from "../../i18n/useI18n";

function StyleRow({
  style,
  onChange,
  onError,
}: {
  style: AdminStyle;
  onChange: (s: AdminStyle) => void;
  onError: (message: string) => void;
}) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);

  async function toggle() {
    try {
      onChange({ ...style, ...(await updateStyle(style.id, { isActive: !style.isActive })) });
    } catch (err) {
      onError(err instanceof Error ? err.message : t("adm.sv.updateStyleFailed"));
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    onError("");
    try {
      const url = await uploadStyleImage(file);
      const saved = await setStyleImage(style.id, url);
      onChange({ ...style, imageUrl: saved.imageUrl });
    } catch (err) {
      onError(err instanceof Error ? err.message : t("adm.sv.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 border-t border-slate-100 py-2 text-sm">
      <div className="flex items-center gap-3">
        {style.imageUrl ? (
          <img
            src={style.imageUrl}
            alt=""
            loading="lazy"
            className="h-10 w-14 rounded object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="h-10 w-14 rounded bg-slate-100" />
        )}
        <span className={style.isActive ? "text-slate-900" : "text-slate-400 line-through"}>
          {style.name} · {t("adm.min", { n: style.durationMinutes })} · {t("adm.money", { n: style.price })}
          {!style.isActive && ` ${t("adm.hiddenTag")}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label
          className={`cursor-pointer rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-100 ${
            uploading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {uploading ? t("adm.sv.uploading") : t("adm.sv.image")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button onClick={toggle} className="rounded-lg border border-slate-300 px-2 py-1 hover:bg-slate-100">
          {style.isActive ? t("adm.sv.hide") : t("adm.sv.show")}
        </button>
      </div>
    </li>
  );
}

function AddStyle({ service, onAdded }: { service: AdminService; onAdded: (s: AdminStyle) => void }) {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t("adm.sv.addStyleFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
      <input
        required
        minLength={2}
        placeholder={t("adm.sv.newStyleName")}
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
        aria-label={t("adm.sv.durationAria")}
        className="w-24 rounded-lg border border-slate-300 p-2 text-sm"
      />
      <input
        type="number"
        required
        min={0}
        placeholder={t("adm.sv.etb")}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        aria-label={t("adm.sv.priceAria")}
        className="w-28 rounded-lg border border-slate-300 p-2 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-700 px-3 py-2 text-sm text-white hover:bg-brand-800 disabled:opacity-50"
      >
        {busy ? t("adm.sv.adding") : t("adm.sv.addStyle")}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

export default function AdminServices() {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t("adm.sv.createFailed"));
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
      setError(err instanceof Error ? err.message : t("adm.sv.updateFailed"));
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
        <p className="font-medium text-gray-900">{t("adm.sv.addService")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            required
            minLength={2}
            placeholder={t("adm.sv.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-gray-300 p-2"
          />
          <input
            placeholder={t("adm.sv.desc")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg border border-gray-300 p-2"
          />
          <label className="text-sm text-gray-600">
            {t("adm.sv.duration")}
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
            {t("adm.sv.price")}
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
          {submitting ? t("adm.sv.adding") : t("adm.sv.addServiceBtn")}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!services && !error && <p className="mt-4 text-gray-500">{t("adm.loading")}</p>}

      <ul className="mt-4 space-y-3">
        {services?.map((s) => (
          <li key={s.id} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-medium ${s.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>{s.name}</p>
                <p className="text-sm text-gray-500">
                  {t("adm.min", { n: s.durationMinutes })} · {t("adm.money", { n: s.price })}{" "}
                  {s.isActive ? "" : t("adm.sv.hiddenFromCustomers")}
                </p>
              </div>
              <button
                onClick={() => toggle(s)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
              >
                {s.isActive ? t("adm.sv.hide") : t("adm.sv.show")}
              </button>
            </div>

            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("adm.sv.styles", { n: s.variants.length })}
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