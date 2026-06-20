import type { MetricContext } from "./metric-context.js";

export interface AssigneeWorkloadEntry {
  userId: string;
  name: string;
  taskCount: number;
  overdueCount: number;
}

export interface ColumnCountEntry {
  column: string;
  count: number;
}

export interface AvgTimeEntry {
  column: string;
  avgHours: number;
}

export interface BoardMetricResult {
  totalTasks?: number;
  doneCount?: number;
  completionRate?: number;
  overdueCount?: number;
  unassignedCount?: number;
  tasksByPriority?: Record<string, number>;
  tasksByColumn?: ColumnCountEntry[];
  byAssignee?: AssigneeWorkloadEntry[];
  avgTimeInColumn?: AvgTimeEntry[];
}

export interface BoardMetricStrategy {
  readonly key: keyof BoardMetricResult;
  compute(ctx: MetricContext): Promise<Partial<BoardMetricResult>>;
}
