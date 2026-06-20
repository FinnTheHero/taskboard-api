# Design patterns — what we built and why

This document walks through the pattern work added to TaskBoard API: **Observer** (new events), **Singleton + transactions**, **Strategy** (task sorting and analytics metrics), and **groups RBAC**. It is written so you can read it aloud in a demo or hand it to a teammate who did not write the code.

For setup and curl examples, see [README.md](./README.md).

---

## Table of contents

1. [Big picture](#big-picture)
2. [Database changes](#database-changes)
3. [Observer — `task.completed` and `task.commented`](#observer--taskcompleted-and-taskcommented)
4. [Singleton + transactions — multi-step writes](#singleton--transactions--multi-step-writes)
5. [Strategy — sorting tasks in a column](#strategy--sorting-tasks-in-a-column)
6. [Strategy — board and group analytics metrics](#strategy--board-and-group-analytics-metrics)
7. [How the patterns work together](#how-the-patterns-work-together)
8. [Files added or changed](#files-added-or-changed)

---

## Big picture

The API already had:

- **MVC** — routes call controllers, controllers call services, services talk to Prisma.
- **Singleton** — one shared `db` client in `src/config/database.ts`.
- **Observer** — services `emit` events; email/in-app **observers** react without the service knowing how notifications are sent.
- **Factory** — `NotificationFactory` builds `EMAIL` or `IN_APP` notification objects.

We extended that with:

| Task | Pattern | What it does |
|------|---------|----------------|
| C | Observer | Two new events when a task is completed or commented |
| D | Singleton + `$transaction` | Move + reorder, bulk archive, board access — all-or-nothing |
| E | Strategy (sort) | Pick how to sort tasks in a column via `?sort=` (DB keyset pagination) |
| F | Strategy (metrics) | Pluggable calculators for board/group analytics |

---

## Database changes

We added fields and models so the features above have something to persist:

```prisma
model Task {
  // ...
  position    Int       @default(0)   // order inside a column (for drag-and-drop)
  archivedAt  DateTime?               // set when bulk-archiving Done tasks
}

model Comment {
  id        String   @id @default(cuid())
  body      String
  taskId    String
  authorId  String
  createdAt DateTime @default(now())
  // relations to Task and User
}
```

**Why:** Moving tasks needs stable ordering (`position`). Archiving needs a flag (`archivedAt`). Comments need their own table so `CommentService` can save text and emit `task.commented`.

Run migrations after pulling:

```bash
pnpm db:migrate
pnpm db:generate
```

---

## Observer — `task.completed` and `task.commented`

### The idea

Think of the **subject** (task services) as a radio station and **observers** as listeners. When something important happens, the service broadcasts one event name and a payload. Listeners decide what to do — send email, write an in-app row, etc. The service never imports Resend or notification code.

We already had `task.created`, `task.moved`, `task.assigned`, and `task.deadline.near`. We added two more event types on the same emitter:

```typescript
// src/patterns/observer/task-event-emitter.ts
export type TaskEvents = {
  // ...existing events...
  "task.completed": { task: Task; owner: User; actor: User };
  "task.commented": {
    task: Task;
    comment: Comment;
    assignee: User;
    actor: User;
  };
};
```

The shape of the pattern did **not** change — only the list of event names grew.

### Who emits what?

**1. Task lands in the Done column → `task.completed`**

When someone moves a task, `TaskService.move` checks: is the target column titled `"Done"` and was the task **not** already in Done? If yes, after the DB update it emits `task.completed` with the group **MANAGER** (so they can be notified).

```typescript
const landedInDone =
  toColumn.title === "Done" && fromColumnTitle !== "Done";

if (landedInDone) {
  const manager = await BoardService.getGroupManagerForBoard(toColumn.boardId);
  if (manager) {
    taskEvents.emit("task.completed", {
      task: updated,
      owner: manager,
      actor,
    });
  }
}
```

**Why the manager, not a board owner?** Boards belong to groups (`Board.groupId`); there is no per-board owner anymore. The product rule is “notify the group manager when work is completed.”

**2. Someone comments → `task.commented`**

`CommentService` saves the comment, then — if the task has an assignee — emits `task.commented`:

```typescript
// src/services/comment.service.ts
const comment = await db.comment.create({
  data: { taskId, authorId: actor.id, body },
});

if (task.assigneeId) {
  const assignee = await db.user.findUnique({ where: { id: task.assigneeId } });
  if (assignee) {
    taskEvents.emit("task.commented", { task, comment, assignee, actor });
  }
}
```

**Why only when there is an assignee?** The product rule is “notify the assignee”; no assignee means nobody to notify.

**API:** `POST /api/tasks/:taskId/comments` with body `{ "body": "Looks good!" }`.

### Who listens?

Observers register at server startup (`registerObservers()` in `src/server.ts`).

**Email observer** — notify assignee on comment, notify group manager on complete (skip if you notified yourself):

```typescript
// src/patterns/observer/observers/email.observer.ts
taskEvents.on("task.commented", async ({ task, assignee, actor }) => {
  if (assignee.id === actor.id) return;
  await NotificationFactory.create("EMAIL", { task, user: assignee }).send();
});

taskEvents.on("task.completed", async ({ task, owner, actor }) => {
  if (owner.id === actor.id) return;
  await NotificationFactory.create("EMAIL", { task, user: owner }).send();
});
```

**In-app observer** does the same users but stores an `IN_APP` notification row instead of sending email.

**Why this is good design:** `TaskService` and `CommentService` stay focused on business rules. Adding Slack later = new observer file, no service edits.

---

## Singleton + transactions — multi-step writes

### The idea

Some operations are **several database steps** that must succeed or fail **together**. Example: move a task to another column **and** renumber every other task’s `position` in both columns. If the move commits but reorder fails, the board order is broken.

Prisma wraps that in `db.$transaction(async (tx) => { ... })`. All `tx.*` calls share one transaction on **one** database connection.

### Why the Singleton matters (say this in the presentation)

```typescript
// src/config/database.ts
export const db = Database.getInstance();
```

There is only **one** `PrismaClient` for the whole app. Transactions are tied to that client’s connection pool.

If you did `const db2 = new PrismaClient()` and tried to mix `db.$transaction` with `db2.task.update`, those would **not** be in the same transaction — you could get half-updated data.

**One-liner for class:** “We use a Singleton so every `$transaction` runs on the same pool instance; you can’t transact across two clients.”

### 1. Move task + reorder positions

`PATCH /api/tasks/:id/move` with `{ "toColumnId": "...", "position": 0 }` (position optional).

Inside one transaction:

1. Load task IDs in the source column (ordered by `position`).
2. Load task IDs in the target column (if moving across columns).
3. Remove the moved task from the source list, insert it at `position` in the target list.
4. Write new `position` (and `columnId` when changing columns) for every affected task.

```typescript
const updated = await db.$transaction(async (tx) => {
  // build ordered id lists, splice moved task in, then:
  await renumberColumn(tx, fromColumnId, withoutMoved);
  await renumberColumn(tx, toColumnId, orderedTarget, taskId, toColumnId);
  return tx.task.findUniqueOrThrow({ where: { id: taskId } });
});

// Events run AFTER the transaction commits — observers only see consistent data
taskEvents.emit("task.moved", { ... });
```

**Why emit after the transaction?** If the transaction rolls back, we should not send “task moved” emails.

### 2. Bulk-archive completed tasks

`POST /api/boards/:id/archive-completed`

Finds the board’s **Done** column and sets `archivedAt` on all non-archived tasks there in one `updateMany` inside `$transaction`.

```typescript
return db.$transaction(async (tx) => {
  const doneColumn = await tx.column.findFirst({
    where: { boardId, title: "Done" },
  });
  const result = await tx.task.updateMany({
    where: { columnId: doneColumn.id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  return { archivedCount: result.count };
});
```

Archived tasks are hidden from column lists and ignored by the deadline scheduler.

### 3. Board access changes (manager-only)

Grant/revoke board access uses `$transaction`-safe upserts on `BoardMember` rows. Managers control who can open a board within their group.

### Board create (already existed)

`BoardService.create` was already using `$transaction` to create the board, default columns (To Do / In Progress / Done), and owner membership in one shot. Task D extended the same pattern to more places.

---

## Strategy — sorting tasks in a column

### The idea

**Strategy** means: define a family of algorithms behind one interface, pick which one to use at **runtime**, and keep each algorithm in its own class.

The sort strategy classes under `src/patterns/strategy/` (`ByPriorityStrategy`, `ByDeadlineStrategy`, etc.) are **reference implementations** of that pattern. At runtime, `TaskService.listByColumn` uses **DB keyset pagination** in `src/utils/cursor.ts` — `buildOrderBy(sort)` and `buildCursorWhere(sort)` — so large columns paginate efficiently without loading everything into memory.

### The interface (reference implementations)

```typescript
// src/patterns/strategy/task-sort-strategy.ts
export interface TaskSortStrategy {
  sort(tasks: ColumnTask[]): ColumnTask[];
}
```

Each class encodes sort rules that are awkward in one SQL clause (e.g. priority rank map, null deadlines last).

### Wiring the HTTP API

`GET /api/tasks/by-column/:columnId?sort=deadline|priority|created|assignee&limit=20&after=...`

```typescript
// TaskService.listByColumn — DB keyset pagination, not in-memory sort
const tasks = await db.task.findMany({
  where: { ...columnFilter, ...buildCursorWhere(sort, cursor) },
  orderBy: buildOrderBy(sort),
  take: limit + 1,
});
```

When `sort` is omitted, tasks return in Kanban `position` order.

**Why keep the strategy classes?** They document the pattern and mirror the same rules the cursor helpers encode for pagination.

---

## Strategy — board and group analytics metrics

### The idea

Analytics uses the same **Strategy** pattern for **metric calculators**. Each metric (completion rate, overdue count, assignee workload, etc.) is a class implementing `BoardMetricStrategy` with a `compute(ctx)` method.

`StatsService` is the **context/orchestrator**: it builds a shared `MetricContext` (column IDs, Done column, overdue scope), runs each strategy, and merges partial results.

### Endpoints

| Method | Path | Scope |
|--------|------|-------|
| `GET` | `/api/boards/:id/stats` | Single board (requires board access) |
| `GET` | `/api/groups/stats` | All boards the user can access in their group |

### Metric strategies

Located in `src/patterns/strategy/metrics/`:

| Class | Returns |
|-------|---------|
| `CompletionRateMetric` | `totalTasks`, `doneCount`, `completionRate` |
| `PriorityBreakdownMetric` | `tasksByPriority` |
| `OverdueCountMetric` | `overdueCount` (excludes Done column) |
| `UnassignedCountMetric` | `unassignedCount` |
| `ColumnDistributionMetric` | `tasksByColumn` |
| `AssigneeWorkloadMetric` | `byAssignee` (task + overdue counts) |
| `AvgTimeInColumnMetric` | `avgTimeInColumn` (uses `columnEnteredAt` from move transactions) |

```typescript
// src/patterns/strategy/metrics/index.ts
export async function computeMetrics(ctx: MetricContext): Promise<BoardMetricResult> {
  for (const strategy of createMetricStrategies()) {
    Object.assign(result, await strategy.compute(ctx));
  }
  return result;
}
```

**Why Strategy here?** Adding a new chart metric = new class + register in `createMetricStrategies()`, without bloating `StatsService`.

**Why not Observer/Factory?** Stats are read-only aggregations; no events or notifications are emitted on fetch.

The frontend **Group Analytics** page (`/group/analytics`) consumes `GET /groups/stats` and renders charts with Recharts.

---

## How the patterns work together

Example: user drags a task to **Done**, then a teammate comments.

1. **`TaskService.move`** runs a **transaction** (column + positions), then **`emit`s** `task.moved` and `task.completed`.
2. **Observers** hear `task.completed` and email the **group manager** (Factory builds the notification).
3. Teammate **`POST`s a comment** → **`CommentService`** saves it and **`emit`s** `task.commented`.
4. Observers notify the **assignee**.
5. Frontend loads the column with **`?sort=priority`** → **Strategy** (DB keyset) paginates the response.
6. Manager opens **Group Analytics** → **`StatsService`** runs **metric strategies** across accessible boards.

Each pattern has a narrow job; they compose without tangling.

---

## Files added or changed

| Area | Paths |
|------|--------|
| Observer events | `src/patterns/observer/task-event-emitter.ts`, `observers/email.observer.ts`, `observers/in-app.observer.ts` |
| Comments | `src/services/comment.service.ts`, `src/controllers/comment.controller.ts`, `prisma` Comment model |
| Transactions | `src/services/task.service.ts` (move), `src/services/board.service.ts` (archive, access) |
| Strategy (sort) | `src/patterns/strategy/*`, `src/utils/cursor.ts` |
| Strategy (metrics) | `src/patterns/strategy/metrics/*`, `src/services/stats.service.ts` |
| Stats routes | `src/routes/board.routes.ts`, `src/routes/group.routes.ts` |
| Schema | `prisma/schema.prisma`, migrations under `prisma/migrations/` |
| Routes | `src/routes/task.routes.ts`, `src/routes/board.routes.ts` |

---

## Quick demo script

```bash
# Sort by priority
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/tasks/by-column/COLUMN_ID?sort=priority"

# Move to Done (fires task.completed for group manager)
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toColumnId":"DONE_COLUMN_ID"}' \
  http://localhost:4000/api/tasks/TASK_ID/move

# Comment (fires task.commented for assignee)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Please review"}' \
  http://localhost:4000/api/tasks/TASK_ID/comments

# Archive all Done tasks on a board
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/boards/BOARD_ID/archive-completed
```

Watch the server console for `[email→...]` and `[in-app→...]` lines when observers run.
