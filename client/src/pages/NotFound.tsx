import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-5xl font-bold text-brand-700">404</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you are looking for does not exist or has moved.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-800"
      >
        Back to home
      </Link>
    </div>
  );
}