import { db } from "../../../config/database.js";
import type { BoardMetricStrategy } from "./board-metric.strategy.js";
import type { MetricContext } from "./metric-context.js";

export class UnassignedCountMetric implements BoardMetricStrategy {
  readonly key = "unassignedCount" as const;

  async compute(ctx: MetricContext) {
    if (ctx.columnIds.length === 0) {
      return { unassignedCount: 0 };
    }

    const unassignedCount = await db.task.count({
      where: {
        columnId: { in: ctx.columnIds },
        archivedAt: null,
        assigneeId: null,
      },
    });

    return { unassignedCount };
  }
}
