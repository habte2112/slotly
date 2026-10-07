import { Router } from "express";
import { listServices, createService, updateService } from "../controllers/services.controller";
import { authenticate, requireRole } from "../middleware/auth";

export const servicesRouter = Router();

servicesRouter.get("/", listServices);
servicesRouter.post("/", authenticate, requireRole("ADMIN"), createService);
servicesRouter.patch("/:id", authenticate, requireRole("ADMIN"), updateService);