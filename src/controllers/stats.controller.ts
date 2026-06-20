import type { Request, Response } from "express";
import { StatsService } from "../services/stats.service.js";

export class StatsController {
  static async getBoardStats(
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> {
    const stats = await StatsService.getBoardStats(
      req.params.id,
      req.user!.id,
    );
    res.json(stats);
  }

  static async getGroupStats(req: Request, res: Response): Promise<void> {
    const stats = await StatsService.getGroupStats(req.user!.id);
    res.json(stats);
  }
}
