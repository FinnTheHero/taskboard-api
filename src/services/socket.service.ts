import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";

let io: Server | null = null;

export class SocketService {
  static init(httpServer: HttpServer): void {
    io = new Server(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN,
        credentials: true,
      },
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth.token as string | undefined;
      if (!token) {
        next(new Error("Authentication required"));
        return;
      }

      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
        socket.join(payload.sub);
        next();
      } catch {
        next(new Error("Invalid or expired token"));
      }
    });

    io.on("connection", () => {
      // Rooms are joined in auth middleware via userId.
    });
  }

  static notifyUser(
    userId: string,
    event: string,
    payload: unknown,
  ): void {
    io?.to(userId).emit(event, payload);
  }
}
