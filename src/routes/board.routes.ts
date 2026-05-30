import { Router } from "express";
import { BoardController } from "../controllers/board.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.get("/", BoardController.list);
router.post("/", BoardController.create);
router.post("/:id/archive-completed", BoardController.archiveCompleted);
router.post("/:id/transfer-ownership", BoardController.transferOwnership);

export default router;
