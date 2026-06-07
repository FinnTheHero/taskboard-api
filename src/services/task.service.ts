import type { Prisma } from "../../generated/prisma/client.js";
import type { User } from "../../generated/prisma/client.js";
import { db } from "../config/database.js";
import { HttpError } from "../middleware/error.middleware.js";
import { taskEvents } from "../patterns/observer/task-event-emitter.js";
import type { SortKey } from "../patterns/strategy/index.js";
import {
  buildCursorWhere,
  buildOrderBy,
  cursorFromTask,
  cursorModeForSort,
  decodeCursor,
  encodeCursor,
} from "../utils/cursor.js";

interface CreateTaskInput {
  columnId: string;
  title: string;
  description?: string | undefined;
  deadline?: Date | undefined;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined;
  assigneeId?: string | undefined;
}

interface ListByColumnOptions {
  sort?: SortKey | undefined;
  limit?: number | undefined;
  after?: string | undefined;
}

async function renumberColumn(
  tx: Prisma.TransactionClient,
  columnId: string,
  orderedIds: string[],
  movedTaskId?: string,
  newColumnId?: string,
): Promise<void> {
  await Promise.all(
    orderedIds.map((id, position) =>
      tx.task.update({
        where: { id },
        data: {
          position,
          ...(id === movedTaskId && newColumnId
            ? { columnId: newColumnId, columnEnteredAt: new Date() }
            : {}),
        },
      }),
    ),
  );
}

export class TaskService {
  static async create(actor: User, input: CreateTaskInput) {
    const column = await db.column.findUnique({
      where: { id: input.columnId },
    });
    if (!column) throw new HttpError(404, "Column not found");

    const { _max } = await db.task.aggregate({
      where: { columnId: input.columnId, archivedAt: null },
      _max: { position: true },
    });
    const position = (_max.position ?? -1) + 1;

    const task = await db.task.create({
      data: {
        columnId: input.columnId,
        title: input.title,
        position,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      },
    });

    taskEvents.emit("task.created", { task, actor });

    if (task.assigneeId && task.assigneeId !== actor.id) {
      const assignee = await db.user.findUnique({
        where: { id: task.assigneeId },
      });
      if (assignee) taskEvents.emit("task.assigned", { task, assignee, actor });
    }

    return task;
  }

  static async move(
    actor: User,
    taskId: string,
    toColumnId: string,
    toPosition?: number,
  ) {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { column: true },
    });
    if (!task) throw new HttpError(404, "Task not found");
    if (task.archivedAt) throw new HttpError(400, "Cannot move archived task");
    if (task.columnId === toColumnId && toPosition === undefined) return task;

    const toColumn = await db.column.findUnique({
      where: { id: toColumnId },
      include: { board: { include: { owner: true } } },
    });
    if (!toColumn) throw new HttpError(404, "Column not found");
    if (toColumn.boardId !== task.column.boardId) {
      throw new HttpError(400, "Column belongs to a different board");
    }

    const fromColumnId = task.columnId;
    const fromColumnTitle = task.column.title;
    const landedInDone =
      toColumn.title === "Done" && fromColumnTitle !== "Done";

    const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const isSameColumn = fromColumnId === toColumnId;

      const sourceTasks = await tx.task.findMany({
        where: { columnId: fromColumnId, archivedAt: null },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      const sourceIds = sourceTasks.map((t) => t.id);
      const withoutMoved = sourceIds.filter((id) => id !== taskId);

      if (isSameColumn) {
        const insertAt = Math.min(
          Math.max(0, toPosition ?? withoutMoved.length),
          withoutMoved.length,
        );
        const ordered = [...withoutMoved];
        ordered.splice(insertAt, 0, taskId);
        await renumberColumn(tx, fromColumnId, ordered);
      } else {
        const targetTasks = await tx.task.findMany({
          where: { columnId: toColumnId, archivedAt: null },
          orderBy: { position: "asc" },
          select: { id: true },
        });
        const targetIds = targetTasks.map((t) => t.id);
        const insertAt = Math.min(
          Math.max(0, toPosition ?? targetIds.length),
          targetIds.length,
        );
        const orderedTarget = [...targetIds];
        orderedTarget.splice(insertAt, 0, taskId);

        await renumberColumn(tx, fromColumnId, withoutMoved);
        await renumberColumn(tx, toColumnId, orderedTarget, taskId, toColumnId);
      }

      return tx.task.findUniqueOrThrow({ where: { id: taskId } });
    });

    taskEvents.emit("task.moved", {
      task: updated,
      fromColumnId,
      toColumnId,
      actor,
    });

    if (landedInDone) {
      taskEvents.emit("task.completed", {
        task: updated,
        owner: toColumn.board.owner,
        actor,
      });
    }

    return updated;
  }

  static async listByColumn(columnId: string, options: ListByColumnOptions = {}) {
    const { sort, after } = options;
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    const column = await db.column.findUnique({ where: { id: columnId } });
    if (!column) throw new HttpError(404, "Column not found");

    const where: Prisma.TaskWhereInput = {
      columnId,
      archivedAt: null,
    };

    if (after) {
      const cursor = decodeCursor(after);
      const expectedMode = cursorModeForSort(sort);
      if (cursor.mode !== expectedMode) {
        throw new HttpError(400, "Cursor does not match sort mode");
      }
      Object.assign(where, buildCursorWhere(sort, cursor));
    }

    const tasks = await db.task.findMany({
      where,
      include: { assignee: { select: { id: true, name: true, email: true } } },
      orderBy: buildOrderBy(sort),
      take: limit + 1,
    });

    const hasMore = tasks.length > limit;
    const data = hasMore ? tasks.slice(0, limit) : tasks;
    const last = data.at(-1);
    const nextCursor =
      hasMore && last ? encodeCursor(cursorFromTask(sort, last)) : null;

    return { data, nextCursor, hasMore };
  }
}
