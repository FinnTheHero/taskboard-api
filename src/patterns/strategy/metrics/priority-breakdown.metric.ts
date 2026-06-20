import { db } from "../../../config/database.js";
import type { BoardMetricStrategy } from "./board-metric.strategy.js";
import type { MetricContext } from "./metric-context.js";

export class PriorityBreakdownMetric implements BoardMetricStrategy {
  readonly key = "tasksByPriority" as const;

  async compute(ctx: MetricContext) {
    if (ctx.columnIds.length === 0) {
      return { tasksByPriority: {} };
    }

    const priorityGroups = await db.task.groupBy({
      by: ["priority"],
      where: {
        columnId: { in: ctx.columnIds },
        archivedAt: null,
        priority: { not: null },
      },
      _count: true,
    });

    const tasksByPriority: Record<string, number> = {};
    for (const group of priorityGroups) {
      if (group.priority) {
        tasksByPriority[group.priority] = group._count;
      }
    }

    return { tasksByPriority };
  }
}
