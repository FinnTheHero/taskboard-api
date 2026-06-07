import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/taskboard_test",
      JWT_SECRET: "test-secret-at-least-16-chars",
    },
  },
});
