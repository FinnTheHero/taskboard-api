import type { ColumnTask, TaskSortStrategy } from "./task-sort-strategy.js";

/** Alphabetical by assignee name; unassigned tasks last. */
export class ByAssigneeStrategy implements TaskSortStrategy {
  sort(tasks: ColumnTask[]): ColumnTask[] {
    return [...tasks].sort((a, b) => {
      const nameA = a.assignee?.name ?? null;
      const nameB = b.assignee?.name ?? null;
      if (!nameA && !nameB) return a.position - b.position;
      if (!nameA) return 1;
      if (!nameB) return -1;
      const byName = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      return byName !== 0 ? byName : a.position - b.position;
    });
  }
}
