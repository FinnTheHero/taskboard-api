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
}
