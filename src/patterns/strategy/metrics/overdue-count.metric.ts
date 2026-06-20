import { db } from "../../../config/database.js";
import type { BoardMetricStrategy } from "./board-metric.strategy.js";
import type { MetricContext } from "./metric-context.js";

export class OverdueCountMetric implements BoardMetricStrategy {
  readonly key = "overdueCount" as const;

  async compute(ctx: MetricContext) {
    if (ctx.overdueColumnIds.length === 0) {
      return { overdueCount: 0 };
    }

    const overdueCount = await db.task.count({
      where: {
        columnId: { in: ctx.overdueColumnIds },
        archivedAt: null,
        deadline: { lt: new Date() },
      },
    });

    return { overdueCount };
  }
}
