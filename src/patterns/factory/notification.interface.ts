import type { Task, User } from "../../../generated/prisma/client.js";

export interface Notification {
  send(): Promise<void>;
}

export interface NotificationContext {
  task: Task;
  user: User;
}
