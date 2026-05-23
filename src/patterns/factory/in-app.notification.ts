import { db } from "../../config/database.js";
import type {
  Notification,
  NotificationContext,
} from "./notification.interface.js";

export class InAppNotification implements Notification {
  constructor(private readonly ctx: NotificationContext) {}

  async send(): Promise<void> {
    const { task, user } = this.ctx;
    // In-app notification = a row the frontend polls / subscribes to.
    await db.notification.create({
      data: { userId: user.id, taskId: task.id, type: "IN_APP" },
    });
    console.log(`[in-app→${user.id}] notification stored for task ${task.id}`);
  }
}
