import { Router } from "express";
import { BoardController } from "../controllers/board.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.get("/", BoardController.list);
router.post("/", BoardController.create);

export default router;
