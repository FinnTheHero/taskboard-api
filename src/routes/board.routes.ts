import { Router } from "express";
import { BoardController } from "../controllers/board.controller.js";
import { StatsController } from "../controllers/stats.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.get("/", BoardController.list);
router.post("/", BoardController.create);
router.get("/:id", BoardController.getById);
router.get("/:id/stats", StatsController.getBoardStats);
router.get("/:id/members", BoardController.listMembers);
router.post("/:id/members", BoardController.grantAccess);
router.delete("/:id/members/:userId", BoardController.revokeAccess);
router.post("/:id/archive-completed", BoardController.archiveCompleted);

export default router;
