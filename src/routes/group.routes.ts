import { Router } from "express";
import { GroupController } from "../controllers/group.controller.js";
import { StatsController } from "../controllers/stats.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.get("/me", GroupController.me);
router.get("/stats", StatsController.getGroupStats);
router.post("/join", GroupController.join);
router.get("/members", GroupController.listMembers);
router.post("/members", GroupController.addMember);
router.delete("/members/:userId", GroupController.removeMember);

export default router;
