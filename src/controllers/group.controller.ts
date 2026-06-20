import type { Request, Response } from "express";
import { z } from "zod";
import { GroupService } from "../services/group.service.js";

const joinSchema = z.object({
  joinCode: z.string().min(6).max(6),
});

const addMemberSchema = z.object({
  email: z.string().email(),
});

export class GroupController {
  static async me(req: Request, res: Response): Promise<void> {
    const membership = await GroupService.getMembership(req.user!.id);
    if (!membership) {
      res.json({ group: null, role: null });
      return;
    }
    res.json(membership);
  }

  static async join(req: Request, res: Response): Promise<void> {
    const { joinCode } = joinSchema.parse(req.body);
    const membership = await GroupService.join(req.user!.id, joinCode);
    res.status(201).json(membership);
  }

  static async listMembers(req: Request, res: Response): Promise<void> {
    const members = await GroupService.listMembers(req.user!.id);
    res.json(
      members.map((m) => ({
        userId: m.userId,
        role: m.role,
        user: m.user,
      })),
    );
  }

  static async addMember(req: Request, res: Response): Promise<void> {
    const { email } = addMemberSchema.parse(req.body);
    const member = await GroupService.addMemberByEmail(req.user!.id, email);
    res.status(201).json({
      userId: member.userId,
      role: member.role,
      user: member.user,
    });
  }

  static async removeMember(
    req: Request<{ userId: string }>,
    res: Response,
  ): Promise<void> {
    await GroupService.removeMember(req.user!.id, req.params.userId);
    res.status(204).send();
  }
}
