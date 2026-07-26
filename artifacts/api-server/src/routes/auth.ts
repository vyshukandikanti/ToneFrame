import { Router } from "express";
import { register, login, logout, me } from "../controllers/auth";
import { requireAuth } from "../middlewares/auth";

const router = Router();

import { authRateLimiter } from "../middlewares/security";

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);

export default router;
