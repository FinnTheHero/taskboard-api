import type { Priority } from "../../../generated/prisma/client.js";
import type { ColumnTask, TaskSortStrategy } from "./task-sort-strategy.js";

const PRIORITY_RANK: Record<Priority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/** Highest priority first; unprioritized tasks last (not expressible as a single SQL ORDER BY). */
export class ByPriorityStrategy implements TaskSortStrategy {
  sort(tasks: ColumnTask[]): ColumnTask[] {
    return [...tasks].sort((a, b) => {
      const rankA = a.priority ? (PRIORITY_RANK[a.priority] ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      const rankB = b.priority ? (PRIORITY_RANK[b.priority] ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
      const byPriority = rankA - rankB;
      return byPriority !== 0 ? byPriority : a.position - b.position;
    });
  }
}
