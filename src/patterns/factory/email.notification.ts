import { Resend } from "resend";
import { env } from "../../config/env.js";
import { db } from "../../config/database.js";
import type {
  Notification,
  NotificationContext,
} from "./notification.interface.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export class EmailNotification implements Notification {
  constructor(private readonly ctx: NotificationContext) {}

  async send(): Promise<void> {
    const { task, user } = this.ctx;
    const subject = `[TaskBoard] Task updated: ${task.title}`;
    const body = `Hi ${user.name},\n\nThe task "${task.title}" (priority: ${task.priority}) has an update.\nDeadline: ${task.deadline?.toISOString() ?? "none"}\n\n— TaskBoard`;

    if (resend) {
      await resend.emails.send({
        from: env.RESEND_FROM,
        to: user.email,
        subject,
        text: body,
      });
    } else {
      // Dev fallback: log instead of sending
      console.log(`[email→${user.email}] ${subject}\n${body}`);
    }

    await db.notification.create({
      data: { userId: user.id, taskId: task.id, type: "EMAIL" },
    });
  }
}
