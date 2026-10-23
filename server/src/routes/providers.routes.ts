import { Router } from "express";
import {
  listProviders,
  getProvider,
  createProvider,
  setProviderServices,
} from "../controllers/providers.controller";
import { getAvailability } from "../controllers/availability.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { listProviderReviews } from "../controllers/reviews.controller";


export const providersRouter = Router();

providersRouter.get("/", listProviders);
providersRouter.get("/:id/availability", getAvailability);
providersRouter.get("/:id", getProvider);
providersRouter.post("/", authenticate, requireRole("ADMIN"), createProvider);
providersRouter.put("/:id/services", authenticate, requireRole("ADMIN"), setProviderServices);
providersRouter.get("/:id/reviews", listProviderReviews);