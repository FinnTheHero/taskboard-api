import type { Request, Response } from "express";
import { z } from "zod";
import { CommentService } from "../services/comment.service.js";

const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export class CommentController {
  static async create(
    req: Request<{ taskId: string }>,
    res: Response,
  ): Promise<void> {
    const { body } = createCommentSchema.parse(req.body);
    const comment = await CommentService.create(req.user!, req.params.taskId, body);
    res.status(201).json(comment);
  }
}
