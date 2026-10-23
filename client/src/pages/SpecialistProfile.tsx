import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProviderReviews, getProviders, type Provider, type RatingInfo, type Review } from "../lib/api";
import Avatar from "../components/ui/Avatar";
import Skeleton from "../components/ui/Skeleton";
import { RatingBadge, Stars } from "../components/ui/Rating";

export default function SpecialistProfile() {
  const { id = "" } = useParams();
  const [provider, setProvider] = useState<Provider | null | undefined>(undefined);
  const [summary, setSummary] = useState<RatingInfo>({ average: 0, count: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getProviders(), getProviderReviews(id)])
      .then(([list, r]) => {
        if (cancelled) return;
        setProvider(list.find((p) => p.id === id) ?? null);
        setSummary(r.summary);
        setReviews(r.reviews);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (provider === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (provider === null) {
    return (
      <p className="text-slate-700">
        Specialist not found.{" "}
        <Link to="/" className="underline">
          Back to services
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← All services
      </Link>

      <header className="flex items-start gap-4">
        <Avatar name={provider.name} className="h-16 w-16 text-2xl" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{provider.name}</h1>
          <RatingBadge info={summary} />
          {provider.bio && <p className="mt-2 max-w-xl text-slate-600">{provider.bio}</p>}
        </div>
      </header>

      <section>
        <h2 className="font-semibold text-slate-900">Services</h2>
        {provider.services.length === 0 && <p className="mt-2 text-slate-500">No services listed yet.</p>}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {provider.services.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
              <span className="font-medium text-slate-900">{s.name}</span>
              <Link
                to={`/book/${s.id}`}
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
              >
                Book
              </Link>
            </li>
          ))}
        </ul>
        {provider.variants.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-slate-600">
            {provider.variants.map((v) => (
              <li key={v.id}>
                {v.name} · {v.price} ETB · {v.durationMinutes} min
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-slate-900">Reviews ({summary.count})</h2>
        {reviews.length === 0 && <p className="mt-2 text-slate-500">No reviews yet.</p>}
        <ul className="mt-3 space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <Stars value={r.rating} />
                <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString("en-GB")}</span>
              </div>
              {r.comment && <p className="mt-2 text-slate-700">{r.comment}</p>}
              <p className="mt-2 text-xs text-slate-500">{r.author}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}