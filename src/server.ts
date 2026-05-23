import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { Database } from "./config/database.js";
import { registerObservers } from "./patterns/observer/index.js";
import {
  startDeadlineScheduler,
  stopDeadlineScheduler,
} from "./services/deadline-scheduler.js";

const app = createApp();

registerObservers();
startDeadlineScheduler();

const server = app.listen(env.PORT, () => {
  console.log(`TaskBoard API listening on http://localhost:${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down...`);
  stopDeadlineScheduler();
  server.close();
  await Database.disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
