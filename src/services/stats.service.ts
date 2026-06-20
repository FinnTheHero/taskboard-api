import { db } from "../config/database.js";
import {
  buildMetricContext,
  computeMetrics,
  type BoardMetricResult,
  type ColumnInfo,
} from "../patterns/strategy/metrics/index.js";
import { BoardService } from "./board.service.js";
import { GroupService } from "./group.service.js";

export interface BoardStats extends BoardMetricResult {
  boardId: string;
}

export interface GroupBoardStatsEntry {
  boardId: string;
  title: string;
  totalTasks: number;
  completionRate: number;
  overdueCount: number;
}

export interface GroupStats extends BoardMetricResult {
  groupId: string;
  groupName: string;
  boardCount: number;
  accessibleBoardCount: number;
  byBoard: GroupBoardStatsEntry[];
}

async function loadColumnsForBoard(boardId: string): Promise<ColumnInfo[]> {
  return db.column.findMany({
    where: { boardId },
    orderBy: { position: "asc" },
    select: { id: true, title: true, position: true, boardId: true },
  });
}

export class StatsService {
  static async getBoardStats(
    boardId: string,
    userId: string,
  ): Promise<BoardStats> {
    await BoardService.assertBoardAccess(boardId, userId);

    const columns = await loadColumnsForBoard(boardId);
    const ctx = buildMetricContext(columns);
    const metrics = await computeMetrics(ctx);

    return {
      boardId,
      ...metrics,
    };
  }

  static async getGroupStats(userId: string): Promise<GroupStats> {
    const { group } = await GroupService.assertInGroup(userId);

    const boards = await db.board.findMany({
      where: { groupId: group.id },
      include: {
        members: { where: { userId }, select: { userId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const accessibleBoards = boards.filter((b) => b.members.length > 0);
    const allColumns: ColumnInfo[] = [];

    for (const board of accessibleBoards) {
      const columns = await loadColumnsForBoard(board.id);
      allColumns.push(...columns);
    }

    const ctx = buildMetricContext(allColumns);
    const metrics = await computeMetrics(ctx);

    const byBoard: GroupBoardStatsEntry[] = await Promise.all(
      accessibleBoards.map(async (board) => {
        const columns = await loadColumnsForBoard(board.id);
        const boardCtx = buildMetricContext(columns);
        const boardMetrics = await computeMetrics(boardCtx);
        return {
          boardId: board.id,
          title: board.title,
          totalTasks: boardMetrics.totalTasks ?? 0,
          completionRate: boardMetrics.completionRate ?? 0,
          overdueCount: boardMetrics.overdueCount ?? 0,
        };
      }),
    );

    return {
      groupId: group.id,
      groupName: group.name,
      boardCount: boards.length,
      accessibleBoardCount: accessibleBoards.length,
      byBoard,
      ...metrics,
    };
  }
}
