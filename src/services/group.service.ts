import { db } from "../config/database.js";
import { HttpError } from "../middleware/error.middleware.js";

export class GroupService {
  static async getMembership(userId: string) {
    const membership = await db.groupMember.findUnique({
      where: { userId },
      include: { group: true },
    });
    if (!membership) return null;
    return {
      group: membership.group,
      role: membership.role,
    };
  }

  static async assertInGroup(userId: string) {
    const membership = await GroupService.getMembership(userId);
    if (!membership) {
      throw new HttpError(403, "You must join a group first");
    }
    return membership;
  }

  static async assertManager(userId: string) {
    const membership = await GroupService.assertInGroup(userId);
    if (membership.role !== "MANAGER") {
      throw new HttpError(403, "Manager role required");
    }
    return membership;
  }

  static async join(userId: string, joinCode: string) {
    const existing = await db.groupMember.findUnique({ where: { userId } });
    if (existing) {
      throw new HttpError(409, "Already a member of a group");
    }

    const normalized = joinCode.trim();
    if (!/^\d{6}$/.test(normalized)) {
      throw new HttpError(400, "Join code must be a 6-digit number");
    }

    const group = await db.group.findUnique({
      where: { joinCode: normalized },
    });
    if (!group) {
      throw new HttpError(404, "Invalid join code");
    }

    const membership = await db.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: "MEMBER",
      },
      include: { group: true },
    });

    return { group: membership.group, role: membership.role };
  }

  static async listMembers(userId: string) {
    const { group } = await GroupService.assertInGroup(userId);
    return db.groupMember.findMany({
      where: { groupId: group.id },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
  }

  static async addMemberByEmail(managerId: string, email: string) {
    const { group } = await GroupService.assertManager(managerId);

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      throw new HttpError(404, "User not found");
    }

    const existing = await db.groupMember.findUnique({
      where: { userId: user.id },
    });
    if (existing) {
      throw new HttpError(409, "User is already in a group");
    }

    return db.groupMember.create({
      data: {
        groupId: group.id,
        userId: user.id,
        role: "MEMBER",
      },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
      },
    });
  }

  static async removeMember(managerId: string, targetUserId: string) {
    const { group } = await GroupService.assertManager(managerId);

    if (managerId === targetUserId) {
      throw new HttpError(400, "Cannot remove yourself from the group");
    }

    const target = await db.groupMember.findUnique({
      where: { userId: targetUserId },
    });
    if (!target || target.groupId !== group.id) {
      throw new HttpError(404, "Member not found in this group");
    }

    await db.$transaction(async (tx) => {
      const boardIds = await tx.board.findMany({
        where: { groupId: group.id },
        select: { id: true },
      });
      await tx.boardMember.deleteMany({
        where: {
          userId: targetUserId,
          boardId: { in: boardIds.map((b) => b.id) },
        },
      });
      await tx.groupMember.delete({
        where: { groupId_userId: { groupId: group.id, userId: targetUserId } },
      });
    });
  }
}
