import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default("TaskBoard <noreply@example.com>"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    // parsed.error.flatten().fieldErrors,
    z.treeifyError(parsed.error),
  );
  process.exit(1);
}

export const env = parsed.data;
