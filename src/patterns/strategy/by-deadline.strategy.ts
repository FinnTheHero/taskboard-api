import type { ColumnTask, TaskSortStrategy } from "./task-sort-strategy.js";

/** Soonest deadline first; tasks without a deadline sink to the bottom. */
export class ByDeadlineStrategy implements TaskSortStrategy {
  sort(tasks: ColumnTask[]): ColumnTask[] {
    return [...tasks].sort((a, b) => {
      if (!a.deadline && !b.deadline) return a.position - b.position;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      const byDeadline = a.deadline.getTime() - b.deadline.getTime();
      return byDeadline !== 0 ? byDeadline : a.position - b.position;
    });
  }
}
