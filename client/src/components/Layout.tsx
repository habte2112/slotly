import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import Avatar from "./ui/Avatar";
import Logo from "./ui/Logo";

export default function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <div className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
        Portfolio demo: please do not enter real personal data.
      </div>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Logo />
            Slotly
          </Link>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {user ? (
              <>
                {user.role === "ADMIN" && (
                  <Link to="/admin" className="text-slate-700 hover:text-brand-700">
                    Admin
                  </Link>
                )}
                {user.role === "PROVIDER" && (
                  <Link to="/dashboard" className="text-slate-700 hover:text-brand-700">
                    Dashboard
                  </Link>
                )}
                <Link to="/my-bookings" className="text-slate-700 hover:text-brand-700">
                  My bookings
                </Link>
                <span className="flex items-center gap-2 text-slate-600">
                  <Avatar name={user.name} className="h-7 w-7 text-xs" />
                  <span className="hidden sm:inline">{user.name}</span>
                </span>
                <button
                  onClick={signOut}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-slate-700 hover:text-brand-700">
                  Log in
                </Link>
                <Link to="/register" className="rounded-lg bg-brand-700 px-3 py-1.5 text-white hover:bg-brand-800">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} Slotly · Portfolio project</span>
          <a
            href="https://github.com/habte2112/slotly"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-900"
          >
            View source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}