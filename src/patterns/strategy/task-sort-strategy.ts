import type { Task } from "../../../generated/prisma/client.js";

/** Task row as returned by column listing (assignee included for name-based sorts). */
export type ColumnTask = Task & {
  assignee: { id: string; name: string; email: string } | null;
};

export interface TaskSortStrategy {
  sort(tasks: ColumnTask[]): ColumnTask[];
}
