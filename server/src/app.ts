import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const userCount = await prisma.user.count();
  res.json({ status: "ok", db: "connected", users: userCount, time: new Date().toISOString() });
});