import { Router } from "express";
import {
  getStats,
  listAdminBookings,
  listAdminServices,
  listAdminProviders,
  createProviderByEmail,
} from "../controllers/admin.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { createVariant, updateVariant, setProviderVariants } from "../controllers/admin-variants.controller";

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole("ADMIN"));

adminRouter.get("/stats", getStats);
adminRouter.get("/bookings", listAdminBookings);
adminRouter.get("/services", listAdminServices);
adminRouter.get("/providers", listAdminProviders);
adminRouter.post("/providers", createProviderByEmail);
adminRouter.post("/services/:serviceId/variants", createVariant);
adminRouter.patch("/variants/:id", updateVariant);
adminRouter.put("/providers/:id/variants", setProviderVariants);