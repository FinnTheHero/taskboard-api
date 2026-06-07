import { Router } from "express";
import { BoardController } from "../controllers/board.controller.js";
import { StatsController } from "../controllers/stats.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.get("/", BoardController.list);
router.post("/", BoardController.create);
router.get("/:id/stats", StatsController.getBoardStats);
router.post("/:id/archive-completed", BoardController.archiveCompleted);
router.post("/:id/transfer-ownership", BoardController.transferOwnership);

export default router;
