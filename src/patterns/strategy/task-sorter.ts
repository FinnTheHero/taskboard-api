import type { ColumnTask, TaskSortStrategy } from "./task-sort-strategy.js";

/** Context: holds a strategy and delegates sorting to it at runtime. */
export class TaskSorter {
  constructor(private strategy: TaskSortStrategy) {}

  setStrategy(strategy: TaskSortStrategy): void {
    this.strategy = strategy;
  }

  sort(tasks: ColumnTask[]): ColumnTask[] {
    return this.strategy.sort(tasks);
  }
}
