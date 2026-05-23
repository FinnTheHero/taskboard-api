import type { NotificationType } from "../../../generated/prisma/client.js";
import type {
  Notification,
  NotificationContext,
} from "./notification.interface.js";
import { EmailNotification } from "./email.notification.js";
import { InAppNotification } from "./in-app.notification.js";

export class NotificationFactory {
  static create(
    type: NotificationType,
    ctx: NotificationContext,
  ): Notification {
    switch (type) {
      case "EMAIL":
        return new EmailNotification(ctx);
      case "IN_APP":
        return new InAppNotification(ctx);
      default: {
        // Exhaustiveness check — TS errors if a new enum value is added without a case.
        const _exhaustive: never = type;
        throw new Error(`Unknown notification type: ${_exhaustive}`);
      }
    }
  }
}
