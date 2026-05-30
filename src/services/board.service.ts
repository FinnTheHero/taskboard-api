import { db } from "../config/database.js";
import { HttpError } from "../middleware/error.middleware.js";

export class BoardService {
  static async listForUser(userId: string) {
    return db.board.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: { columns: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(userId: string, title: string) {
    // Create board with default columns in a single transaction.
    return db.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          title,
          ownerId: userId,
          members: { create: { userId, role: "OWNER" } },
          columns: {
            create: [
              { title: "To Do", position: 0 },
              { title: "In Progress", position: 1 },
              { title: "Done", position: 2 },
            ],
          },
        },
        include: { columns: { orderBy: { position: "asc" } } },
      });
      return board;
    });
  }

  static async assertMember(boardId: string, userId: string) {
    const member = await db.teamMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
    if (!member) throw new HttpError(403, "Not a member of this board");
    return member;
  }

  static async assertOwner(boardId: string, userId: string) {
    const board = await db.board.findUnique({ where: { id: boardId } });
    if (!board) throw new HttpError(404, "Board not found");
    if (board.ownerId !== userId) {
      throw new HttpError(403, "Only the board owner can perform this action");
    }
    return board;
  }

  /** Atomically stamp archivedAt on every non-archived task in the Done column. */
  static async archiveCompletedTasks(boardId: string, userId: string) {
    await BoardService.assertMember(boardId, userId);

    return db.$transaction(async (tx) => {
      const doneColumn = await tx.column.findFirst({
        where: { boardId, title: "Done" },
      });
      if (!doneColumn) return { archivedCount: 0 };

      const result = await tx.task.updateMany({
        where: { columnId: doneColumn.id, archivedAt: null },
        data: { archivedAt: new Date() },
      });

      return { archivedCount: result.count };
    });
  }

  /** Atomically swap board.ownerId and OWNER/MEMBER roles on TeamMember. */
  static async transferOwnership(
    boardId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ) {
    if (currentOwnerId === newOwnerId) {
      throw new HttpError(400, "New owner must be a different user");
    }

    await BoardService.assertOwner(boardId, currentOwnerId);

    const newOwnerMember = await db.teamMember.findUnique({
      where: { boardId_userId: { boardId, userId: newOwnerId } },
    });
    if (!newOwnerMember) {
      throw new HttpError(400, "New owner must already be a board member");
    }

    return db.$transaction(async (tx) => {
      const board = await tx.board.update({
        where: { id: boardId },
        data: { ownerId: newOwnerId },
        include: { owner: { select: { id: true, name: true, email: true } } },
      });

      await tx.teamMember.update({
        where: { boardId_userId: { boardId, userId: currentOwnerId } },
        data: { role: "MEMBER" },
      });

      await tx.teamMember.update({
        where: { boardId_userId: { boardId, userId: newOwnerId } },
        data: { role: "OWNER" },
      });

      return board;
    });
  }
}
