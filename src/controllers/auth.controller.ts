import type { Request, Response } from "express";
import { z } from "zod";
import { AuthService } from "../services/auth.service.js";

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    const input = registerSchema.parse(req.body);
    const result = await AuthService.register(input);
    res.status(201).json(result);
  }

  static async login(req: Request, res: Response): Promise<void> {
    const input = loginSchema.parse(req.body);
    const result = await AuthService.login(input);
    res.json(result);
  }

  static async me(req: Request, res: Response): Promise<void> {
    const { id, name, email, createdAt } = req.user!;
    res.json({ id, name, email, createdAt });
  }
}
