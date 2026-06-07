import type { Prisma } from "../../generated/prisma/client.js";
import type { Priority } from "../../generated/prisma/client.js";
import type { SortKey } from "../patterns/strategy/index.js";

const PRIORITY_DESC: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function lowerPriorities(priority: string): Priority[] {
  const idx = PRIORITY_DESC.indexOf(priority as Priority);
  if (idx === -1) return [];
  return PRIORITY_DESC.slice(idx + 1);
}

export type TaskCursor =
  | { mode: "position"; position: number; id: string }
  | { mode: "deadline"; deadline: string | null; id: string }
  | { mode: "priority"; priority: string | null; id: string }
  | { mode: "created"; createdAt: string; id: string }
  | { mode: "assignee"; assigneeId: string | null; id: string };

export function encodeCursor(cursor: TaskCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(after: string): TaskCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(after, "base64url").toString("utf8"),
    ) as TaskCursor;
    if (!parsed?.mode || !parsed.id) {
      throw new Error("Invalid cursor");
    }
    return parsed;
  } catch {
    throw new Error("Invalid cursor");
  }
}

export function buildCursorWhere(
  sort: SortKey | undefined,
  cursor: TaskCursor,
): Prisma.TaskWhereInput {
  switch (cursor.mode) {
    case "position":
      return {
        OR: [
          { position: { gt: cursor.position } },
          { AND: [{ position: cursor.position }, { id: { gt: cursor.id } }] },
        ],
      };
    case "created":
      return {
        OR: [
          { createdAt: { gt: new Date(cursor.createdAt) } },
          {
            AND: [
              { createdAt: new Date(cursor.createdAt) },
              { id: { gt: cursor.id } },
            ],
          },
        ],
      };
    case "deadline":
      if (cursor.deadline === null) {
        return { deadline: null, id: { gt: cursor.id } };
      }
      return {
        OR: [
          { deadline: { gt: new Date(cursor.deadline) } },
          {
            AND: [
              { deadline: new Date(cursor.deadline) },
              { id: { gt: cursor.id } },
            ],
          },
          { deadline: null },
        ],
      };
    case "priority":
      if (cursor.priority === null) {
        return { priority: null, id: { gt: cursor.id } };
      }
      return {
        OR: [
          ...lowerPriorities(cursor.priority).map((priority) => ({ priority })),
          {
            AND: [
              { priority: cursor.priority as Priority },
              { id: { gt: cursor.id } },
            ],
          },
          { priority: null },
        ],
      };
    case "assignee":
      if (cursor.assigneeId === null) {
        return { assigneeId: null, id: { gt: cursor.id } };
      }
      return {
        OR: [
          { assigneeId: { gt: cursor.assigneeId } },
          {
            AND: [
              { assigneeId: cursor.assigneeId },
              { id: { gt: cursor.id } },
            ],
          },
          { assigneeId: null },
        ],
      };
    default:
      return {};
  }
}

export function buildOrderBy(
  sort: SortKey | undefined,
): Prisma.TaskOrderByWithRelationInput[] {
  switch (sort) {
    case "deadline":
      return [{ deadline: { sort: "asc", nulls: "last" } }, { id: "asc" }];
    case "priority":
      return [{ priority: { sort: "desc", nulls: "last" } }, { id: "asc" }];
    case "created":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "assignee":
      return [{ assigneeId: { sort: "asc", nulls: "last" } }, { id: "asc" }];
    default:
      return [{ position: "asc" }, { id: "asc" }];
  }
}

export function cursorFromTask(
  sort: SortKey | undefined,
  task: {
    id: string;
    position: number;
    deadline: Date | null;
    priority: string | null;
    createdAt: Date;
    assigneeId: string | null;
  },
): TaskCursor {
  switch (sort) {
    case "deadline":
      return {
        mode: "deadline",
        deadline: task.deadline?.toISOString() ?? null,
        id: task.id,
      };
    case "priority":
      return { mode: "priority", priority: task.priority, id: task.id };
    case "created":
      return {
        mode: "created",
        createdAt: task.createdAt.toISOString(),
        id: task.id,
      };
    case "assignee":
      return {
        mode: "assignee",
        assigneeId: task.assigneeId,
        id: task.id,
      };
    default:
      return { mode: "position", position: task.position, id: task.id };
  }
}

export function cursorModeForSort(
  sort: SortKey | undefined,
): TaskCursor["mode"] {
  switch (sort) {
    case "deadline":
      return "deadline";
    case "priority":
      return "priority";
    case "created":
      return "created";
    case "assignee":
      return "assignee";
    default:
      return "position";
  }
}
