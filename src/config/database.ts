import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env.js";

class Database {
  private static instance: PrismaClient | null = null;

  // Private constructor prevents `new Database()` from outside.
  private constructor() {}

  public static getInstance(): PrismaClient {
    if (!Database.instance) {
      const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
      Database.instance = new PrismaClient({
        adapter,
        log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      });
    }
    return Database.instance;
  }

  public static async disconnect(): Promise<void> {
    if (Database.instance) {
      await Database.instance.$disconnect();
      Database.instance = null;
    }
  }
}

export const db = Database.getInstance();
export { Database };
