import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import BookingPage from "./pages/BookingPage";
import MyBookings from "./pages/MyBookings";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/book/:serviceId" element={<BookingPage />} />
        <Route element={<ProtectedRoute />}>
                <Route element={<ProtectedRoute role="PROVIDER" />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
          <Route path="/my-bookings" element={<MyBookings />} />
        </Route>
      </Route>
    </Routes>
  );
}