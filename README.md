# TaskBoard API

REST API for the TaskBoard project
Express 5 + TypeScript + Prisma 7 + PostgreSQL + Socket.io

**Pattern walkthrough (what we built, with code and explanations):** see **[PATTERNS.md](./PATTERNS.md)**.

## Design patterns

| Pattern   | Location                                              | Role                                          |
|-----------|-------------------------------------------------------|-----------------------------------------------|
| MVC       | `routes/` → `controllers/` → `services/` → `prisma/` | Overall layered architecture                  |
| Singleton | `src/config/database.ts`                              | Single shared PrismaClient; `$transaction` needs one pool instance |
| Observer  | `src/patterns/observer/`                              | Task events broadcast to subscribers          |
| Factory   | `src/patterns/factory/`                               | Builds notification objects by type           |
| Strategy  | `src/patterns/strategy/`                              | Sort via DB keyset (`cursor.ts`); analytics metrics in `strategy/metrics/` |

## Setup

```bash
# 1. Install deps
pnpm install

# 2. Configure env
cp .env.example .env
# edit DATABASE_URL + JWT_SECRET

# 3. Create database, then:
pnpm db:migrate

# 4. Seed demo data (optional, for live demo)
pnpm db:seed

# 5. Run
pnpm dev
```

API base URL: `http://localhost:4000/api`

### Demo credentials (after seed)

| User  | Email            | Password   | Group role |
|-------|------------------|------------|------------|
| Alice | `alice@demo.com` | `demo1234` | MANAGER in Acme Corp (`100001`) |
| Bob   | `bob@demo.com`   | `demo1234` | Not in a group — join with a code |

### Demo group join codes

| Group      | Join code |
|------------|-----------|
| Acme Corp  | `100001`  |
| Beta Labs  | `200002`  |

Users can only belong to **one group**. Join via `POST /api/groups/join` with `{ "joinCode": "100001" }`.

### Transactions & the database Singleton

`db` in `src/config/database.ts` is a **Singleton** `PrismaClient`. Every `db.$transaction(async (tx) => { ... })` runs multiple SQL statements on **one connection** from that client’s pool — they commit together or roll back together.

If you created a second `PrismaClient`, a transaction on `db` could not include writes from the other instance. That is why board create, task move (column change + position reorder), bulk archive, and board access changes all go through the exported `db` singleton.

## Inspecting the DB

```bash
pnpm db:studio
```

## Routes

| Method | Path                              | Auth | Description                |
|--------|-----------------------------------|------|----------------------------|
| GET    | `/api/health`                     | —    | Liveness check             |
| POST   | `/api/auth/register`              | —    | `{ name, email, password }` → `{ user, accessToken, refreshToken }` |
| POST   | `/api/auth/login`                 | —    | `{ email, password }` → `{ user, accessToken, refreshToken }` |
| POST   | `/api/auth/refresh`               | —    | `{ refreshToken }` → new token pair (rotation) |
| POST   | `/api/auth/logout`                | —    | `{ refreshToken }` → 204, revokes token |
| GET    | `/api/auth/me`                    | ✓    | Current user               |
| GET    | `/api/groups/me`                  | ✓    | Current group + role, or null |
| POST   | `/api/groups/join`                | ✓    | `{ joinCode }` — 6-digit code |
| GET    | `/api/groups/stats`               | ✓    | Group analytics across accessible boards |
| GET    | `/api/groups/members`             | ✓    | List members in your group |
| POST   | `/api/groups/members`             | ✓ MANAGER | `{ email }` — add user as MEMBER |
| DELETE | `/api/groups/members/:userId`     | ✓ MANAGER | Remove member from group |
| GET    | `/api/boards`                     | ✓    | All group boards with `hasAccess` flag |
| GET    | `/api/boards/:id`                 | ✓    | Full board (requires board access) |
| POST   | `/api/boards`                     | ✓ MANAGER | `{ title }` — create board in group |
| GET    | `/api/boards/:id/members`         | ✓ MANAGER | List users with board access |
| GET    | `/api/boards/:id/assignable-members` | ✓ | List assignable users (any board member) |
| POST   | `/api/boards/:id/members`         | ✓ MANAGER | `{ userId }` — grant board access |
| DELETE | `/api/boards/:id/members/:userId` | ✓ MANAGER | Revoke board access |
| GET    | `/api/boards/:id/stats`           | ✓    | Board analytics (requires board access); see below |
| POST   | `/api/boards/:id/archive-completed` | ✓ MANAGER | Bulk-archive Done tasks (requires board access) |
| POST   | `/api/tasks`                      | ✓    | Create task (`assigneeId` optional; must be a board member) |
| PATCH  | `/api/tasks/:id/assign`           | ✓    | `{ assigneeId: string \| null }` — assign or unassign |
| PATCH  | `/api/tasks/:id/move`             | ✓    | `{ toColumnId, position? }` — move + reorder (`$transaction`) |
| GET    | `/api/tasks/by-column/:columnId`  | ✓    | Paginated tasks; see below |
| POST   | `/api/tasks/:taskId/comments`     | ✓    | `{ body }` — emits `task.commented` |

### Task list pagination

`GET /api/tasks/by-column/:columnId` returns:

```json
{
  "data": [ /* Task[] */ ],
  "nextCursor": "eyJ...",
  "hasMore": true
}
```

Query params:

- `limit` — page size (default `20`, max `100`)
- `after` — opaque cursor from previous response’s `nextCursor`
- `sort` — optional: `deadline`, `priority`, `created`, `assignee` (default: column position order)

When the user changes sort, reset `after` and fetch from the start. Use the same `sort` value on every “load more” request.

### Board and group analytics

`GET /api/boards/:id/stats` and `GET /api/groups/stats` return aggregated task metrics computed by **Strategy** classes in `src/patterns/strategy/metrics/`:

```json
{
  "totalTasks": 10,
  "doneCount": 3,
  "completionRate": 30,
  "overdueCount": 2,
  "unassignedCount": 1,
  "tasksByPriority": { "HIGH": 2, "MEDIUM": 5 },
  "tasksByColumn": [{ "column": "To Do", "count": 4 }],
  "byAssignee": [{ "userId": "...", "name": "Alice", "taskCount": 5, "overdueCount": 1 }],
  "avgTimeInColumn": [{ "column": "In Progress", "avgHours": 8.5 }]
}
```

Group stats add `groupId`, `groupName`, `boardCount`, `accessibleBoardCount`, and `byBoard[]` (per-board completion breakdown). Overdue counts exclude tasks in the Done column.

### Auth token lifecycle

1. Login/register → store `accessToken` (15 min) and `refreshToken` (7 days)
2. Send `Authorization: Bearer <accessToken>` on API calls
3. Before access expiry (or on 401), call `POST /api/auth/refresh` with `{ refreshToken }`
4. Replace both tokens with the new pair (old refresh token is revoked)
5. Logout → `POST /api/auth/logout` with `{ refreshToken }`

## Real-time notifications (React)

The backend pushes in-app notifications over WebSocket after saving them to the DB. The frontend can subscribe instead of polling.

### 1. Install client

```bash
pnpm add socket.io-client
```

### 2. Connect after login

```ts
import { io, Socket } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export function connectNotifications(accessToken: string) {
  disconnectNotifications();

  socket = io(API_URL, {
    auth: { token: accessToken },
    transports: ["websocket", "polling"],
  });

  socket.on("notification", (payload: { taskId: string; type: string }) => {
    // Refetch your notifications list or patch local state
    console.log("New notification", payload);
  });

  socket.on("connect_error", (err) => {
    console.error("Socket connect error", err.message);
  });
}

export function disconnectNotifications() {
  socket?.disconnect();
  socket = null;
}
```

### 3. Reconnect after token refresh

When you refresh tokens, disconnect and reconnect with the new `accessToken`:

```ts
const { accessToken, refreshToken } = await refreshTokens(storedRefreshToken);
connectNotifications(accessToken);
```

### 4. Disconnect on logout

```ts
await fetch(`${API_URL}/api/auth/logout`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refreshToken }),
});
disconnectNotifications();
```

### Event shape

| Event          | Payload                                      |
|----------------|----------------------------------------------|
| `notification` | `{ taskId: string, type: "IN_APP" }`         |

Rooms are keyed by user ID — only the logged-in user receives their notifications.

For production (Railway backend + Cloudflare Pages frontend), set `VITE_API_URL` to your Railway service URL. Socket.io uses the same origin as the REST API.

## Smoke test

```bash
# 1. Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"a@b.com","password":"password123"}'
# → { user: {...}, accessToken: "...", refreshToken: "..." }

# 2. Create a board (paste the accessToken from step 1)
TOKEN="..."
curl -X POST http://localhost:4000/api/boards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My first board"}'
# → board with 3 columns (To Do / In Progress / Done)

# 3. List tasks in a column (paginated)
curl "http://localhost:4000/api/tasks/by-column/<COL_ID>?limit=20" \
  -H "Authorization: Bearer $TOKEN"
# → { data: [...], nextCursor: null, hasMore: false }

# 4. Board stats
curl http://localhost:4000/api/boards/<BOARD_ID>/stats \
  -H "Authorization: Bearer $TOKEN"
```
