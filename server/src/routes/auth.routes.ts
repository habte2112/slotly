import { Router } from "express";
import { register, login, me, forgotPassword, resetPassword, setLocale, changePassword } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { forgotPasswordLimiter, loginLimiter, registerLimiter } from "../middleware/rate-limit";
export const authRouter = Router();

authRouter.post("/register", registerLimiter, register);
authRouter.post("/login", loginLimiter, login);
authRouter.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
authRouter.post("/reset-password", resetPassword);
authRouter.get("/me", authenticate, me);
authRouter.patch("/locale", authenticate, setLocale);
authRouter.post("/change-password", authenticate, loginLimiter, changePassword);