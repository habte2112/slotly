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
import { getUploadSignature, setVariantImage } from "../controllers/admin-images.controller";
import { listAdminReviews, setReviewHidden } from "../controllers/reviews.controller";
import { createAdminBooking } from "../controllers/admin-bookings.controller";


export const adminRouter = Router();

adminRouter.use(authenticate, requireRole("ADMIN"));

adminRouter.get("/stats", getStats);
adminRouter.get("/bookings", listAdminBookings);
adminRouter.post("/bookings", createAdminBooking);
adminRouter.get("/services", listAdminServices);
adminRouter.get("/providers", listAdminProviders);
adminRouter.post("/providers", createProviderByEmail);
adminRouter.post("/services/:serviceId/variants", createVariant);
adminRouter.patch("/variants/:id", updateVariant);
adminRouter.put("/providers/:id/variants", setProviderVariants);
adminRouter.post("/uploads/sign", getUploadSignature);
adminRouter.put("/variants/:id/image", setVariantImage);
adminRouter.get("/reviews", listAdminReviews);
adminRouter.patch("/reviews/:id", setReviewHidden);