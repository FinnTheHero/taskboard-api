import type { User } from "../../generated/prisma/client.js";
import { db } from "../config/database.js";
import { HttpError } from "../middleware/error.middleware.js";
import { taskEvents } from "../patterns/observer/task-event-emitter.js";
import { BoardService } from "./board.service.js";

export class CommentService {
  static async create(actor: User, taskId: string, body: string) {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { column: true },
    });
    if (!task) throw new HttpError(404, "Task not found");

    await BoardService.assertMember(task.column.boardId, actor.id);

    const comment = await db.comment.create({
      data: { taskId, authorId: actor.id, body },
    });

    if (task.assigneeId) {
      const assignee = await db.user.findUnique({
        where: { id: task.assigneeId },
      });
      if (assignee) {
        taskEvents.emit("task.commented", { task, comment, assignee, actor });
      }
    }

    return comment;
  }
}
