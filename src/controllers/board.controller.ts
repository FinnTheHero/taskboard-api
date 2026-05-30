import type { Request, Response } from "express";
import { z } from "zod";
import { BoardService } from "../services/board.service.js";

const createBoardSchema = z.object({ title: z.string().min(1).max(120) });

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1),
});

export class BoardController {
  static async list(req: Request, res: Response): Promise<void> {
    const boards = await BoardService.listForUser(req.user!.id);
    res.json(boards);
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

  static async transferOwnership(
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> {
    const { newOwnerId } = transferOwnershipSchema.parse(req.body);
    const board = await BoardService.transferOwnership(
      req.params.id,
      req.user!.id,
      newOwnerId,
    );
    res.json(board);
  }
}
