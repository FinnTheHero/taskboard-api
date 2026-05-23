import type { Request, Response } from "express";
import { z } from "zod";
import { BoardService } from "../services/board.service.js";

const createBoardSchema = z.object({ title: z.string().min(1).max(120) });

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
}
