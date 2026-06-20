import { db } from "../../../config/database.js";
import type { BoardMetricStrategy } from "./board-metric.strategy.js";
import type { MetricContext } from "./metric-context.js";

export class CompletionRateMetric implements BoardMetricStrategy {
  readonly key = "completionRate" as const;

  async compute(ctx: MetricContext) {
    if (ctx.columnIds.length === 0) {
      return {
        totalTasks: 0,
        doneCount: 0,
        completionRate: 0,
      };
    }

    const totalTasks = await db.task.count({
      where: { columnId: { in: ctx.columnIds }, archivedAt: null },
    });

    const doneCount = ctx.doneColumnId
      ? await db.task.count({
          where: { columnId: ctx.doneColumnId, archivedAt: null },
        })
      : 0;

    const completionRate =
      totalTasks === 0
        ? 0
        : Math.round((doneCount / totalTasks) * 1000) / 10;

    return { totalTasks, doneCount, completionRate };
  }
}
