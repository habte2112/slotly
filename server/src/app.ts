import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { apiLimiter } from "./middleware/rate-limit";
import { authRouter } from "./routes/auth.routes";
import { servicesRouter } from "./routes/services.routes";
import { providersRouter } from "./routes/providers.routes";
import { bookingsRouter } from "./routes/bookings.routes";
import { providerDashboardRouter } from "./routes/provider-dashboard.routes";
import { internalRouter } from "./routes/internal.routes";

export const app = express();

// Render ከ proxy ጀርባ ስለሆነ
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    // ባዶ ከሆነ ሌሎች origins አይፈቀዱም (frontend በ /api proxy ስለሚጠራ CORS አያስፈልግም)
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",").map((s) => s.trim()) : false,
  }),
);
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", async (_req, res) => {
  const userCount = await prisma.user.count();
  res.json({ status: "ok", db: "connected", users: userCount, time: new Date().toISOString() });
});

app.use("/api", apiLimiter);

app.use("/api/auth", authRouter);
app.use("/api/services", servicesRouter);
app.use("/api/providers", providersRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/provider", providerDashboardRouter);
app.use("/api/internal", internalRouter);

// ስህተቶች እዚህ ይያዛሉ (ከራውተሮች በኋላ)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status =
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
      ? err.status
      : 500;

  // የተበላሸ JSON ወይም በጣም ትልቅ body (client ስህተት)
  if (status >= 400 && status < 500) {
    res.status(status).json({ message: status === 413 ? "Request body too large" : "Invalid request" });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});