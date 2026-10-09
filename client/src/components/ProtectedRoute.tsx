import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import type { User } from "../lib/api";

export default function ProtectedRoute({ role }: { role?: User["role"] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}