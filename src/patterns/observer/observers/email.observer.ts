import { taskEvents } from "../task-event-emitter.js";
import { NotificationFactory } from "../../factory/notification.factory.js";

export function registerEmailObserver(): void {
  taskEvents.on("task.assigned", async ({ task, assignee, actor }) => {
    if (assignee.id === actor.id) return; // don't email yourself
    await NotificationFactory.create("EMAIL", { task, user: assignee }).send();
  });

  taskEvents.on("task.deadline.near", async ({ task, assignee }) => {
    await NotificationFactory.create("EMAIL", { task, user: assignee }).send();
  });
}
