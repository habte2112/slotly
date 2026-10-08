import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { authRouter } from "./routes/auth.routes";
import { servicesRouter } from "./routes/services.routes";
import { providersRouter } from "./routes/providers.routes";
import { bookingsRouter } from "./routes/bookings.routes";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const userCount = await prisma.user.count();
  res.json({ status: "ok", db: "connected", users: userCount, time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/services", servicesRouter);
app.use("/api/providers", providersRouter);
app.use("/api/bookings", bookingsRouter);
// ያልተጠበቀ ስህተት ሁሉ እዚህ ይያዛል (ከራውተሮች በኋላ መሆን አለበት)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});