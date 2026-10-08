import { Router } from "express";
import { createBooking, listMyBookings, cancelBooking } from "../controllers/bookings.controller";
import { authenticate } from "../middleware/auth";

export const bookingsRouter = Router();

bookingsRouter.post("/", authenticate, createBooking);
bookingsRouter.get("/my", authenticate, listMyBookings);
bookingsRouter.patch("/:id/cancel", authenticate, cancelBooking);