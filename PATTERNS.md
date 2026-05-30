# Design patterns — what we built and why

This document walks through the pattern work added to TaskBoard API: **Observer** (new events), **Singleton + transactions**, and **Strategy** (task sorting). It is written so you can read it aloud in a demo or hand it to a teammate who did not write the code.

For setup and curl examples, see [README.md](./README.md).

---

## Table of contents

1. [Big picture](#big-picture)
2. [Database changes](#database-changes)
3. [Observer — `task.completed` and `task.commented`](#observer--taskcompleted-and-taskcommented)
4. [Singleton + transactions — multi-step writes](#singleton--transactions--multi-step-writes)
5. [Strategy — sorting tasks in a column](#strategy--sorting-tasks-in-a-column)
6. [How the patterns work together](#how-the-patterns-work-together)
7. [Files added or changed](#files-added-or-changed)

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
| D | Singleton + `$transaction` | Move + reorder, bulk archive, transfer ownership — all-or-nothing |
| E | Strategy | Pick how to sort tasks in a column via `?sort=` |

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

When someone moves a task, `TaskService.move` checks: is the target column titled `"Done"` and was the task **not** already in Done? If yes, after the DB update it emits `task.completed` with the board **owner** (so they can be notified).

```typescript
const landedInDone =
  toColumn.title === "Done" && fromColumnTitle !== "Done";

if (landedInDone) {
  taskEvents.emit("task.completed", {
    task: updated,
    owner: toColumn.board.owner,
    actor,
  });
}
```

**Why not emit on every move?** Only completing (entering Done) is the business moment we care about for the owner.

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

**Email observer** — notify assignee on comment, notify owner on complete (skip if you notified yourself):

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

### 3. Transfer board ownership

`POST /api/boards/:id/transfer-ownership` with `{ "newOwnerId": "..." }` (current owner only).

One transaction updates three things:

1. `Board.ownerId` → new owner  
2. Old owner’s `TeamMember.role` → `MEMBER`  
3. New owner’s `TeamMember.role` → `OWNER`  

If step 2 failed after step 1, you could have a board pointing at a user who is still marked `MEMBER` in the team table — the transaction prevents that.

### Board create (already existed)

`BoardService.create` was already using `$transaction` to create the board, default columns (To Do / In Progress / Done), and owner membership in one shot. Task D extended the same pattern to more places.

---

## Strategy — sorting tasks in a column

### The idea

**Strategy** means: define a family of algorithms behind one interface, pick which one to use at **runtime**, and keep each algorithm in its own class.

“Sort by priority” is not the same code path as “sort by deadline”:

- Priority needs a **rank map** (`CRITICAL` > `HIGH` > …), not alphabetical enum order.
- Deadline must push **null** deadlines to the bottom.
- Assignee sort uses **names** and puts unassigned tasks last.

That is real logic, not a single `ORDER BY priority ASC` in SQL.

### The interface and context

```typescript
// src/patterns/strategy/task-sort-strategy.ts
export interface TaskSortStrategy {
  sort(tasks: ColumnTask[]): ColumnTask[];
}

// src/patterns/strategy/task-sorter.ts
export class TaskSorter {
  constructor(private strategy: TaskSortStrategy) {}

  setStrategy(strategy: TaskSortStrategy): void {
    this.strategy = strategy;
  }

  sort(tasks: ColumnTask[]): ColumnTask[] {
    return this.strategy.sort(tasks);
  }
}
```

- **Strategy** = `ByPriorityStrategy`, `ByDeadlineStrategy`, etc.  
- **Context** = `TaskSorter` — holds whichever strategy you chose and calls `sort()`.

### Example strategy: priority

```typescript
const PRIORITY_RANK: Record<Priority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export class ByPriorityStrategy implements TaskSortStrategy {
  sort(tasks: ColumnTask[]): ColumnTask[] {
    return [...tasks].sort((a, b) => {
      const rankA = a.priority ? PRIORITY_RANK[a.priority] : Number.POSITIVE_INFINITY;
      const rankB = b.priority ? PRIORITY_RANK[b.priority] : Number.POSITIVE_INFINITY;
      const byPriority = rankA - rankB;
      return byPriority !== 0 ? byPriority : a.position - b.position;
    });
  }
}
```

Tasks without priority sink to the bottom (`POSITIVE_INFINITY`). Ties break by manual `position` so order stays stable.

### Wiring the HTTP API

`GET /api/tasks/by-column/:columnId?sort=deadline|priority|created|assignee`

```typescript
// Controller validates query
const { sort } = listByColumnQuerySchema.parse(req.query);

// Service loads tasks, then optionally sorts in memory
const tasks = await db.task.findMany({ ... });
if (!sort) return tasks;           // default: Kanban position order
return sortColumnTasks(tasks, sort); // Strategy picked from ?sort=
```

Factory helper:

```typescript
// src/patterns/strategy/index.ts
export function createSortStrategy(key: SortKey): TaskSortStrategy {
  switch (key) {
    case "deadline": return new ByDeadlineStrategy();
    case "priority": return new ByPriorityStrategy();
    case "created":  return new ByCreatedDateStrategy();
    case "assignee": return new ByAssigneeStrategy();
  }
}
```

**Why load from DB then sort in JS?** The strategies encapsulate rules that are awkward or wrong in one SQL clause. We fetch the column’s tasks once, then apply the chosen algorithm — classic Strategy.

---

## How the patterns work together

Example: user drags a task to **Done**, then a teammate comments.

1. **`TaskService.move`** runs a **transaction** (column + positions), then **`emit`s** `task.moved` and `task.completed`.
2. **Observers** hear `task.completed` and email the **board owner** (Factory builds the notification).
3. Teammate **`POST`s a comment** → **`CommentService`** saves it and **`emit`s** `task.commented`.
4. Observers notify the **assignee**.
5. Frontend loads the column with **`?sort=priority`** → **Strategy** reorders the JSON response.

Each pattern has a narrow job; they compose without tangling.

---

## Files added or changed

| Area | Paths |
|------|--------|
| Observer events | `src/patterns/observer/task-event-emitter.ts`, `observers/email.observer.ts`, `observers/in-app.observer.ts` |
| Comments | `src/services/comment.service.ts`, `src/controllers/comment.controller.ts`, `prisma` Comment model |
| Transactions | `src/services/task.service.ts` (move), `src/services/board.service.ts` (archive, transfer), `src/config/database.ts` |
| Strategy | `src/patterns/strategy/*` |
| Schema | `prisma/schema.prisma`, migrations under `prisma/migrations/` |
| Routes | `src/routes/task.routes.ts`, `src/routes/board.routes.ts` |

---

## Quick demo script

```bash
# Sort by priority
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/tasks/by-column/COLUMN_ID?sort=priority"

# Move to Done (fires task.completed for owner)
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
