import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import BookingPage from "./pages/BookingPage";
import MyBookings from "./pages/MyBookings";
import Dashboard from "./pages/Dashboard";
import Reschedule from "./pages/Reschedule";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/book/:serviceId" element={<BookingPage />} />
      <Route path="*" element={<NotFound />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/reschedule/:id" element={<Reschedule />} />
    </Route>

    <Route element={<ProtectedRoute role="PROVIDER" />}>
      <Route path="/dashboard" element={<Dashboard />} />
    </Route>

    <Route element={<ProtectedRoute role="ADMIN" />}>
      <Route path="/admin" element={<Admin />} />
      </Route>
    </Route>
  </Routes>
  );
}