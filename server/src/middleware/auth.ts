import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing token" });
    return;
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  if (typeof payload.sub !== "string") {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  // ሚናው እና የ password ለውጥ ጊዜ ከዳታቤዝ ይነበባሉ፣ ስለዚህ ለውጥ ወዲያው ይተገበራል
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, passwordChangedAt: true },
  });
  if (!user) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  // iat በሰከንድ ነው፤ ተመሳሳይ ሰከንድ ውስጥ የተሰጠ አዲስ token እንዳይከለከል በሰከንድ ይነጻጸራል
  const issuedAt = payload.iat ?? 0;
  if (user.passwordChangedAt && issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    res.status(401).json({ message: "Session expired. Please log in again." });
    return;
  }

  req.user = { id: user.id, role: user.role };
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
}