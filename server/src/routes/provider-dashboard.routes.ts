import { Router } from "express";
import {
  getOwnProfile,
  setWorkingHours,
  addTimeOff,
  deleteTimeOff,
  listProviderBookings,
  updateBookingStatus,
  createManualBooking
} from "../controllers/provider-dashboard.controller";
import { authenticate, requireRole } from "../middleware/auth";

export const providerDashboardRouter = Router();

// ሁሉም መንገዶች ለ PROVIDER ሚና ብቻ ናቸው
providerDashboardRouter.use(authenticate, requireRole("PROVIDER"));

providerDashboardRouter.get("/me", getOwnProfile);
providerDashboardRouter.put("/working-hours", setWorkingHours);
providerDashboardRouter.post("/time-off", addTimeOff);
providerDashboardRouter.delete("/time-off/:id", deleteTimeOff);
providerDashboardRouter.get("/bookings", listProviderBookings);
providerDashboardRouter.patch("/bookings/:id/status", updateBookingStatus);
providerDashboardRouter.post("/bookings", createManualBooking);