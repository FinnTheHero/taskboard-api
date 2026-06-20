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

const moveTaskSchema = z.object({
  toColumnId: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

const assignTaskSchema = z.object({
  assigneeId: z.string().nullable(),
});

const listByColumnQuerySchema = z.object({
  sort: z.enum(["deadline", "priority", "created", "assignee"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  after: z.string().optional(),
});

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
    const { toColumnId, position } = moveTaskSchema.parse(req.body);
    const task = await TaskService.move(req.user!, id, toColumnId, position);
    res.json(task);
  }

  static async listByColumn(
    req: Request<{ columnId: string }>,
    res: Response,
  ): Promise<void> {
    const query = listByColumnQuerySchema.parse(req.query);
    const result = await TaskService.listByColumn(
      req.params.columnId,
      req.user!.id,
      query,
    );
    res.json(result);
  }

  static async assign(
    req: Request<{ id: string }>,
    res: Response,
  ): Promise<void> {
    const { assigneeId } = assignTaskSchema.parse(req.body);
    const task = await TaskService.assign(req.user!, req.params.id, assigneeId);
    res.json(task);
  }
}
