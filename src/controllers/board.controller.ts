import type { Request, Response } from "express";
import { z } from "zod";
import { BoardService } from "../services/board.service.js";

const createBoardSchema = z.object({ title: z.string().min(1).max(120) });

const boardMemberSchema = z.object({
  userId: z.string().min(1),
});

export class BoardController {
  static async list(req: Request, res: Response): Promise<void> {
    const boards = await BoardService.listForUser(req.user!.id);
    res.json(boards);
  }

  static async getById(req: Request<{ id: string }>, res: Response): Promise<void> {
    const board = await BoardService.getById(req.params.id, req.user!.id);
    res.json(board);
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { title } = createBoardSchema.parse(req.body);
    const board = await BoardService.create(req.user!.id, title);
    res.status(201).json(board);
  }

  static async archiveCompleted(
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> {
    const result = await BoardService.archiveCompletedTasks(
      req.params.id,
      req.user!.id,
    );
    res.json(result);
  }

  static async grantAccess(
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> {
    const { userId } = boardMemberSchema.parse(req.body);
    const member = await BoardService.grantAccess(
      req.params.id,
      req.user!.id,
      userId,
    );
    res.status(201).json(member);
  }

  static async revokeAccess(
    req: Request<{ id: string; userId: string }>,
    res: Response,
  ): Promise<void> {
    await BoardService.revokeAccess(
      req.params.id,
      req.user!.id,
      req.params.userId,
    );
    res.status(204).send();
  }

  static async listMembers(
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> {
    const members = await BoardService.listBoardMembers(
      req.params.id,
      req.user!.id,
    );
    res.json(members);
  }

  static async listAssignableMembers(
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> {
    const members = await BoardService.listAssignableMembers(
      req.params.id,
      req.user!.id,
    );
    res.json(members);
  }
}
