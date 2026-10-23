import { Router } from "express";
import {
  createBooking,
  listMyBookings,
  cancelBooking,
  getRescheduleAvailability,
  rescheduleBooking,
} from "../controllers/bookings.controller";
import { authenticate } from "../middleware/auth";
import { createReview } from "../controllers/reviews.controller";

export const bookingsRouter = Router();

bookingsRouter.post("/", authenticate, createBooking);
bookingsRouter.get("/my", authenticate, listMyBookings);
bookingsRouter.get("/:id/availability", authenticate, getRescheduleAvailability);
bookingsRouter.patch("/:id/cancel", authenticate, cancelBooking);
bookingsRouter.patch("/:id/reschedule", authenticate, rescheduleBooking);
bookingsRouter.post("/:id/review", authenticate, createReview);