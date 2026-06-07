import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error.middleware.js";
import { expiresAtFromNow } from "../utils/duration.js";

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
    const tokens = await AuthService.issueTokenPair(user.id);
    return {
      user: AuthService.sanitize(user),
      ...tokens,
    };
  }

  static async login(input: { email: string; password: string }) {
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (!user) throw new HttpError(401, "Invalid credentials");

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new HttpError(401, "Invalid credentials");

    const tokens = await AuthService.issueTokenPair(user.id);
    return {
      user: AuthService.sanitize(user),
      ...tokens,
    };
  }

  static async refresh(refreshToken: string) {
    const stored = await db.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (!stored) throw new HttpError(401, "Invalid refresh token");

    if (stored.revoked) {
      await db.refreshToken.updateMany({
        where: { familyId: stored.familyId },
        data: { revoked: true },
      });
      throw new HttpError(401, "Refresh token reuse detected");
    }

    if (stored.expiresAt < new Date()) {
      throw new HttpError(401, "Refresh token expired");
    }

    await db.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const newRefreshToken = crypto.randomBytes(32).toString("hex");
    await db.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: stored.userId,
        familyId: stored.familyId,
        expiresAt: expiresAtFromNow(env.REFRESH_TOKEN_EXPIRES_IN),
      },
    });

    const user = await db.user.findUniqueOrThrow({
      where: { id: stored.userId },
    });

    return {
      user: AuthService.sanitize(user),
      accessToken: AuthService.sign(user.id),
      refreshToken: newRefreshToken,
    };
  }

  static async logout(refreshToken: string) {
    const stored = await db.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (stored) {
      await db.refreshToken.update({
        where: { id: stored.id },
        data: { revoked: true },
      });
    }
  }

  private static async issueTokenPair(userId: string) {
    const familyId = crypto.randomBytes(16).toString("hex");
    const refreshToken = crypto.randomBytes(32).toString("hex");

    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        familyId,
        expiresAt: expiresAtFromNow(env.REFRESH_TOKEN_EXPIRES_IN),
      },
    });

    return {
      accessToken: AuthService.sign(userId),
      refreshToken,
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
