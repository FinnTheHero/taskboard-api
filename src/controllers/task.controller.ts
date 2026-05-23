import type { Request, Response } from "express";
import { z } from "zod";
import { TaskService } from "../services/task.service.js";

const createTaskSchema = z.object({
  columnId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  deadline: z.coerce.date().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assigneeId: z.string().optional(),
});

const moveTaskSchema = z.object({ toColumnId: z.string().min(1) });

export class TaskController {
  static async create(req: Request, res: Response): Promise<void> {
    const input = createTaskSchema.parse(req.body);
    const task = await TaskService.create(req.user!, input);
    res.status(201).json(task);
  }

  static async move(
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> {
    const id = req.params.id;
    const { toColumnId } = moveTaskSchema.parse(req.body);
    const task = await TaskService.move(req.user!, id, toColumnId);
    res.json(task);
  }

  static async listByColumn(
    req: Request<{ columnId: string }>,
    res: Response,
  ): Promise<void> {
    const tasks = await TaskService.listByColumn(req.params.columnId);
    res.json(tasks);
  }
}
