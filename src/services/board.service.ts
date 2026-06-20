import type { Prisma } from "../../generated/prisma/client.js";
import { db } from "../config/database.js";
import { HttpError } from "../middleware/error.middleware.js";
import { GroupService } from "./group.service.js";

export class BoardService {
  static async listForUser(userId: string) {
    const { group } = await GroupService.assertInGroup(userId);

    const boards = await db.board.findMany({
      where: { groupId: group.id },
      include: {
        members: { where: { userId }, select: { userId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return boards.map((board) => ({
      id: board.id,
      title: board.title,
      groupId: board.groupId,
      createdAt: board.createdAt,
      hasAccess: board.members.length > 0,
    }));
  }

  static async getById(boardId: string, userId: string) {
    await BoardService.assertBoardInUserGroup(boardId, userId);
    await BoardService.assertBoardAccess(boardId, userId);

    return db.board.findUniqueOrThrow({
      where: { id: boardId },
      include: { columns: { orderBy: { position: "asc" } } },
    });
  }

  static async create(userId: string, title: string) {
    const { group } = await GroupService.assertManager(userId);

    return db.$transaction(async (tx: Prisma.TransactionClient) => {
      const board = await tx.board.create({
        data: {
          title,
          groupId: group.id,
          members: { create: { userId } },
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

  static async assertBoardInUserGroup(boardId: string, userId: string) {
    const { group } = await GroupService.assertInGroup(userId);
    const board = await db.board.findUnique({ where: { id: boardId } });
    if (!board) throw new HttpError(404, "Board not found");
    if (board.groupId !== group.id) {
      throw new HttpError(403, "Board belongs to a different group");
    }
    return board;
  }

  static async assertBoardAccess(boardId: string, userId: string) {
    await BoardService.assertBoardInUserGroup(boardId, userId);
    const member = await db.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
    if (!member) {
      throw new HttpError(403, "You do not have access to this board");
    }
    return member;
  }

  /** @deprecated Use assertBoardAccess */
  static async assertMember(boardId: string, userId: string) {
    return BoardService.assertBoardAccess(boardId, userId);
  }

  static async listBoardMembers(boardId: string, userId: string) {
    await GroupService.assertManager(userId);
    await BoardService.assertBoardInUserGroup(boardId, userId);

    return db.boardMember.findMany({
      where: { boardId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  static async grantAccess(boardId: string, managerId: string, targetUserId: string) {
    const { group } = await GroupService.assertManager(managerId);
    await BoardService.assertBoardInUserGroup(boardId, managerId);

    const targetMember = await db.groupMember.findUnique({
      where: { userId: targetUserId },
    });
    if (!targetMember || targetMember.groupId !== group.id) {
      throw new HttpError(400, "User must be a member of your group");
    }

    return db.boardMember.upsert({
      where: { boardId_userId: { boardId, userId: targetUserId } },
      create: { boardId, userId: targetUserId },
      update: {},
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  static async revokeAccess(
    boardId: string,
    managerId: string,
    targetUserId: string,
  ) {
    await GroupService.assertManager(managerId);
    await BoardService.assertBoardInUserGroup(boardId, managerId);

    const member = await db.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: targetUserId } },
    });
    if (!member) {
      throw new HttpError(404, "User does not have access to this board");
    }

    await db.boardMember.delete({
      where: { boardId_userId: { boardId, userId: targetUserId } },
    });
  }

  static async archiveCompletedTasks(boardId: string, userId: string) {
    await GroupService.assertManager(userId);
    await BoardService.assertBoardAccess(boardId, userId);

    return db.$transaction(async (tx: Prisma.TransactionClient) => {
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

  static async getGroupManagerForBoard(boardId: string) {
    const board = await db.board.findUnique({
      where: { id: boardId },
      include: {
        group: {
          include: {
            members: {
              where: { role: "MANAGER" },
              include: { user: true },
              take: 1,
            },
          },
        },
      },
    });
    return board?.group.members[0]?.user ?? null;
  }
}
