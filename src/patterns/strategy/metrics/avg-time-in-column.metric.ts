import { db } from "../../../config/database.js";
import type { BoardMetricStrategy } from "./board-metric.strategy.js";
import type { MetricContext } from "./metric-context.js";

export class AvgTimeInColumnMetric implements BoardMetricStrategy {
  readonly key = "avgTimeInColumn" as const;

  async compute(ctx: MetricContext) {
    const now = Date.now();
    const avgTimeInColumn = await Promise.all(
      ctx.columns.map(async (col) => {
        const tasks = await db.task.findMany({
          where: { columnId: col.id, archivedAt: null },
          select: { columnEnteredAt: true },
        });
        if (tasks.length === 0) {
          return { column: col.title, avgHours: 0 };
        }
        const totalHours = tasks.reduce(
          (sum, t) => sum + (now - t.columnEnteredAt.getTime()) / 3_600_000,
          0,
        );
        return {
          column: col.title,
          avgHours: Math.round((totalHours / tasks.length) * 10) / 10,
        };
      }),
    );

    return { avgTimeInColumn };
  }
}
