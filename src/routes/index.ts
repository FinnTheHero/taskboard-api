import { Router } from "express";
import authRoutes from "./auth.routes.js";
import boardRoutes from "./board.routes.js";
import groupRoutes from "./group.routes.js";
import taskRoutes from "./task.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/auth", authRoutes);
router.use("/groups", groupRoutes);
router.use("/boards", boardRoutes);
router.use("/tasks", taskRoutes);

export default router;
