import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/auth-context";

export default function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <nav className="mx-auto flex max-w-4xl items-center justify-between p-4">
          <Link to="/" className="text-xl font-bold text-gray-900">
            Slotly
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <Link to="/my-bookings" className="text-gray-700 hover:text-gray-900">
                  My bookings
                </Link>
                <span className="text-gray-500">{user.name}</span>
                <button onClick={signOut} className="rounded-lg border border-gray-300 px-3 py-1 hover:bg-gray-100">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-gray-900">
                  Log in
                </Link>
                <Link to="/register" className="rounded-lg bg-gray-900 px-3 py-1 text-white hover:bg-gray-700">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Outlet />
      </main>
    </div>
  );
}