import { db } from "../../../config/database.js";
import type { BoardMetricStrategy } from "./board-metric.strategy.js";
import type { MetricContext } from "./metric-context.js";

export class AssigneeWorkloadMetric implements BoardMetricStrategy {
  readonly key = "byAssignee" as const;

  async compute(ctx: MetricContext) {
    if (ctx.columnIds.length === 0) {
      return { byAssignee: [] };
    }

    const now = new Date();
    const overdueWhere = {
      columnId: { in: ctx.overdueColumnIds },
      archivedAt: null,
      deadline: { lt: now },
    };

    const assignedGroups = await db.task.groupBy({
      by: ["assigneeId"],
      where: {
        columnId: { in: ctx.columnIds },
        archivedAt: null,
        assigneeId: { not: null },
      },
      _count: true,
    });

    const overdueGroups = await db.task.groupBy({
      by: ["assigneeId"],
      where: {
        ...overdueWhere,
        assigneeId: { not: null },
      },
      _count: true,
    });

    const overdueByAssignee = new Map(
      overdueGroups
        .filter((g) => g.assigneeId)
        .map((g) => [g.assigneeId!, g._count]),
    );

    const assigneeIds = assignedGroups
      .map((g) => g.assigneeId)
      .filter((id): id is string => id !== null);

    if (assigneeIds.length === 0) {
      return { byAssignee: [] };
    }

    const users = await db.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    const byAssignee = assignedGroups
      .filter((g) => g.assigneeId)
      .map((g) => ({
        userId: g.assigneeId!,
        name: nameById.get(g.assigneeId!) ?? "Unknown",
        taskCount: g._count,
        overdueCount: overdueByAssignee.get(g.assigneeId!) ?? 0,
      }))
      .sort((a, b) => b.taskCount - a.taskCount);

    return { byAssignee };
  }
}
