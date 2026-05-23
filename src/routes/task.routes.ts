import { Router } from "express";
import { TaskController } from "../controllers/task.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.post("/", TaskController.create);
router.patch("/:id/move", TaskController.move);
router.get("/by-column/:columnId", TaskController.listByColumn);

export default router;
