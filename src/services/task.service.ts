import type { User } from "../../generated/prisma/client.js";
import { db } from "../config/database.js";
import { HttpError } from "../middleware/error.middleware.js";
import { taskEvents } from "../patterns/observer/task-event-emitter.js";

interface CreateTaskInput {
  columnId: string;
  title: string;
  description?: string;
  deadline?: Date;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assigneeId?: string;
}

export class TaskService {
  static async create(actor: User, input: CreateTaskInput) {
    const column = await db.column.findUnique({
      where: { id: input.columnId },
    });
    if (!column) throw new HttpError(404, "Column not found");

    const task = await db.task.create({ data: input });

    taskEvents.emit("task.created", { task, actor });

    if (task.assigneeId && task.assigneeId !== actor.id) {
      const assignee = await db.user.findUnique({
        where: { id: task.assigneeId },
      });
      if (assignee) taskEvents.emit("task.assigned", { task, assignee, actor });
    }

    return task;
  }

  static async move(actor: User, taskId: string, toColumnId: string) {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) throw new HttpError(404, "Task not found");
    if (task.columnId === toColumnId) return task;

    const updated = await db.task.update({
      where: { id: taskId },
      data: { columnId: toColumnId },
    });

    taskEvents.emit("task.moved", {
      task: updated,
      fromColumnId: task.columnId,
      toColumnId,
      actor,
    });

    return updated;
  }

  static async listByColumn(columnId: string) {
    return db.task.findMany({
      where: { columnId },
      include: { assignee: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }
}
