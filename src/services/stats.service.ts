import { db } from "../config/database.js";
import { BoardService } from "./board.service.js";

export class StatsService {
  static async getBoardStats(boardId: string, userId: string) {
    await BoardService.assertMember(boardId, userId);

    const columns = await db.column.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
    });
    const columnIds = columns.map((c) => c.id);
    const doneColumn = columns.find((c) => c.title === "Done");

    const totalTasks = await db.task.count({
      where: { columnId: { in: columnIds }, archivedAt: null },
    });

    const doneCount = doneColumn
      ? await db.task.count({
          where: { columnId: doneColumn.id, archivedAt: null },
        })
      : 0;

    const completionRate =
      totalTasks === 0
        ? 0
        : Math.round((doneCount / totalTasks) * 1000) / 10;

    const priorityGroups = await db.task.groupBy({
      by: ["priority"],
      where: {
        columnId: { in: columnIds },
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

    const now = Date.now();
    const avgTimeInColumn = await Promise.all(
      columns.map(async (col) => {
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

    const overdueCount = await db.task.count({
      where: {
        columnId: { in: columnIds },
        archivedAt: null,
        deadline: { lt: new Date() },
      },
    });

    return {
      completionRate,
      tasksByPriority,
      avgTimeInColumn,
      overdueCount,
    };
  }
}
