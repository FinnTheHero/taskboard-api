import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/register", authRateLimiter, AuthController.register);
router.post("/login", authRateLimiter, AuthController.login);
router.get("/me", authenticate, AuthController.me);

export default router;
