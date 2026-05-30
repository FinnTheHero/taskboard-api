import { ByAssigneeStrategy } from "./by-assignee.strategy.js";
import { ByCreatedDateStrategy } from "./by-created-date.strategy.js";
import { ByDeadlineStrategy } from "./by-deadline.strategy.js";
import { ByPriorityStrategy } from "./by-priority.strategy.js";
import { TaskSorter } from "./task-sorter.js";
import type { ColumnTask, TaskSortStrategy } from "./task-sort-strategy.js";

export type SortKey = "deadline" | "priority" | "created" | "assignee";

export function createSortStrategy(key: SortKey): TaskSortStrategy {
  switch (key) {
    case "deadline":
      return new ByDeadlineStrategy();
    case "priority":
      return new ByPriorityStrategy();
    case "created":
      return new ByCreatedDateStrategy();
    case "assignee":
      return new ByAssigneeStrategy();
    default: {
      const _exhaustive: never = key;
      throw new Error(`Unknown sort key: ${_exhaustive}`);
    }
  }
}

export function sortColumnTasks(tasks: ColumnTask[], key: SortKey): ColumnTask[] {
  return new TaskSorter(createSortStrategy(key)).sort(tasks);
}

export type { ColumnTask, TaskSortStrategy } from "./task-sort-strategy.js";
export { TaskSorter } from "./task-sorter.js";
export { ByAssigneeStrategy } from "./by-assignee.strategy.js";
export { ByCreatedDateStrategy } from "./by-created-date.strategy.js";
export { ByDeadlineStrategy } from "./by-deadline.strategy.js";
export { ByPriorityStrategy } from "./by-priority.strategy.js";
