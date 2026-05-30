import { db } from "../config/database.js";
import { taskEvents } from "../patterns/observer/task-event-emitter.js";

const CHECK_INTERVAL_MS = 60_000; // 1 min
const WINDOW_HOURS = 24;

let timer: NodeJS.Timeout | null = null;
const alreadyNotified = new Set<string>();

async function checkAndEmit(): Promise<void> {
  const cutoff = new Date(Date.now() + WINDOW_HOURS * 60 * 60 * 1000);
  const dueSoon = await db.task.findMany({
    where: {
      deadline: { lte: cutoff, gte: new Date() },
      assigneeId: { not: null },
      archivedAt: null,
    },
    include: { assignee: true },
  });

  for (const task of dueSoon) {
    if (!task.assignee || alreadyNotified.has(task.id)) continue;
    taskEvents.emit("task.deadline.near", { task, assignee: task.assignee });
    alreadyNotified.add(task.id);
  }
}

export function startDeadlineScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    checkAndEmit().catch((err) => console.error("[deadline-scheduler]", err));
  }, CHECK_INTERVAL_MS);
  console.log(
    `✓ Deadline scheduler started (every ${CHECK_INTERVAL_MS / 1000}s, window ${WINDOW_HOURS}h)`,
  );
}

export function stopDeadlineScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
