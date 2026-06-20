import { db } from "../../../config/database.js";
import type { BoardMetricStrategy } from "./board-metric.strategy.js";
import type { MetricContext } from "./metric-context.js";

export class ColumnDistributionMetric implements BoardMetricStrategy {
  readonly key = "tasksByColumn" as const;

  async compute(ctx: MetricContext) {
    const tasksByColumn = await Promise.all(
      ctx.columns.map(async (col) => {
        const count = await db.task.count({
          where: { columnId: col.id, archivedAt: null },
        });
        return { column: col.title, count };
      }),
    );

    return { tasksByColumn };
  }
}
