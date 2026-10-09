import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getServices, type Service } from "../lib/api";

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServices()
      .then(setServices)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900">Book your appointment</h1>
      <p className="mt-1 text-gray-600">Choose a service to get started.</p>

      {loading && <p className="mt-6 text-gray-500">Loading services...</p>}
      {error && <p className="mt-6 text-red-600">{error}</p>}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <li key={s.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900">{s.name}</h2>
            <p className="mt-1 text-sm text-gray-600">{s.description}</p>
            <p className="mt-3 text-sm text-gray-700">
              {s.durationMinutes} min · <span className="font-medium">{s.price} ETB</span>
            </p>
            <Link
              to={`/book/${s.id}`}
              className="mt-4 rounded-lg bg-gray-900 px-3 py-2 text-center text-sm text-white hover:bg-gray-700"
            >
              Book now
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}