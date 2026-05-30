import { taskEvents } from "../task-event-emitter.js";
import { NotificationFactory } from "../../factory/notification.factory.js";

export function registerInAppObserver(): void {
  taskEvents.on("task.created", async ({ task, actor }) => {
    await NotificationFactory.create("IN_APP", { task, user: actor }).send();
  });

  taskEvents.on("task.moved", async ({ task, actor }) => {
    await NotificationFactory.create("IN_APP", { task, user: actor }).send();
  });

  taskEvents.on("task.assigned", async ({ task, assignee }) => {
    await NotificationFactory.create("IN_APP", { task, user: assignee }).send();
  });

  taskEvents.on("task.commented", async ({ task, assignee, actor }) => {
    if (assignee.id === actor.id) return;
    await NotificationFactory.create("IN_APP", { task, user: assignee }).send();
  });

  taskEvents.on("task.completed", async ({ task, owner, actor }) => {
    if (owner.id === actor.id) return;
    await NotificationFactory.create("IN_APP", { task, user: owner }).send();
  });
}
