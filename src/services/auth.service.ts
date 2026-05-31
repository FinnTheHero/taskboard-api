import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.middleware.js";

export class AuthService {
  static async register(input: {
    name: string;
    email: string;
    password: string;
  }) {
    const existing = await db.user.findUnique({
      where: { email: input.email },
    });
    if (existing) throw new HttpError(409, "Email already registered");

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await db.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });
    return {
      user: AuthService.sanitize(user),
      token: AuthService.sign(user.id),
    };
  }

  static async login(input: { email: string; password: string }) {
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (!user) throw new HttpError(401, "Invalid credentials");

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new HttpError(401, "Invalid credentials");

    return {
      user: AuthService.sanitize(user),
      token: AuthService.sign(user.id),
    };
  }

  private static sign(userId: string): string {
    const opts: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as Exclude<SignOptions["expiresIn"], undefined>,
    };
    return jwt.sign({ sub: userId }, env.JWT_SECRET, opts);
  }

  private static sanitize(user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
