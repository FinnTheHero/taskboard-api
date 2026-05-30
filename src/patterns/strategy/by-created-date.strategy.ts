import type { ColumnTask, TaskSortStrategy } from "./task-sort-strategy.js";

/** Newest tasks first. */
export class ByCreatedDateStrategy implements TaskSortStrategy {
  sort(tasks: ColumnTask[]): ColumnTask[] {
    return [...tasks].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
}
