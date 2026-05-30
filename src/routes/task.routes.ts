import { Router } from "express";
import { CommentController } from "../controllers/comment.controller.js";
import { TaskController } from "../controllers/task.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.post("/", TaskController.create);
router.patch("/:id/move", TaskController.move);
router.get("/by-column/:columnId", TaskController.listByColumn);
router.post("/:taskId/comments", CommentController.create);

export default router;
