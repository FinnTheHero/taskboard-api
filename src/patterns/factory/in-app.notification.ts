import { db } from "../../config/database.js";
import { SocketService } from "../../services/socket.service.js";
import type {
  Notification,
  NotificationContext,
} from "./notification.interface.js";

export class InAppNotification implements Notification {
  constructor(private readonly ctx: NotificationContext) {}

  async send(): Promise<void> {
    const { task, user } = this.ctx;
    await db.notification.create({
      data: { userId: user.id, taskId: task.id, type: "IN_APP" },
    });
    SocketService.notifyUser(user.id, "notification", {
      taskId: task.id,
      type: "IN_APP",
    });
    console.log(`[in-app→${user.id}] notification stored for task ${task.id}`);
  }
}
