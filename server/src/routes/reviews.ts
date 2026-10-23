import { Router } from "express";
import { ratingsSummary, myReviewedBookings } from "../controllers/reviews.controller";
import { authenticate } from "../middleware/auth";

export const reviewsRouter = Router();

reviewsRouter.get("/summary", ratingsSummary);
reviewsRouter.get("/mine", authenticate, myReviewedBookings);