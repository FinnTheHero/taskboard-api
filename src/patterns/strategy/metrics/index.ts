import { AssigneeWorkloadMetric } from "./assignee-workload.metric.js";
import { AvgTimeInColumnMetric } from "./avg-time-in-column.metric.js";
import type { BoardMetricResult, BoardMetricStrategy } from "./board-metric.strategy.js";
import { ColumnDistributionMetric } from "./column-distribution.metric.js";
import { CompletionRateMetric } from "./completion-rate.metric.js";
import { OverdueCountMetric } from "./overdue-count.metric.js";
import { PriorityBreakdownMetric } from "./priority-breakdown.metric.js";
import { UnassignedCountMetric } from "./unassigned-count.metric.js";
import type { MetricContext } from "./metric-context.js";

export function createMetricStrategies(): BoardMetricStrategy[] {
  return [
    new CompletionRateMetric(),
    new PriorityBreakdownMetric(),
    new OverdueCountMetric(),
    new UnassignedCountMetric(),
    new ColumnDistributionMetric(),
    new AssigneeWorkloadMetric(),
    new AvgTimeInColumnMetric(),
  ];
}

export async function computeMetrics(
  ctx: MetricContext,
): Promise<BoardMetricResult> {
  const strategies = createMetricStrategies();
  const result: BoardMetricResult = {};

  for (const strategy of strategies) {
    Object.assign(result, await strategy.compute(ctx));
  }

  return result;
}

export type {
  AssigneeWorkloadEntry,
  AvgTimeEntry,
  BoardMetricResult,
  BoardMetricStrategy,
  ColumnCountEntry,
} from "./board-metric.strategy.js";
export { buildMetricContext } from "./metric-context.js";
export type { ColumnInfo, MetricContext } from "./metric-context.js";
