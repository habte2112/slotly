import { Router } from "express";
import {
  listProviders,
  getProvider,
  createProvider,
  setProviderServices,
} from "../controllers/providers.controller";
import { authenticate, requireRole } from "../middleware/auth";

export const providersRouter = Router();

providersRouter.get("/", listProviders);
providersRouter.get("/:id", getProvider);
providersRouter.post("/", authenticate, requireRole("ADMIN"), createProvider);
providersRouter.put("/:id/services", authenticate, requireRole("ADMIN"), setProviderServices);