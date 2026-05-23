# TaskBoard API

REST API for the TaskBoard project
Express 5 + TypeScript + Prisma 7 + PostgreSQL

## Design patterns

| Pattern   | Location                                              | Role                                          |
|-----------|-------------------------------------------------------|-----------------------------------------------|
| MVC       | `routes/` → `controllers/` → `services/` → `prisma/` | Overall layered architecture                  |
| Singleton | `src/config/database.ts`                              | Single shared PrismaClient + connection pool  |
| Observer  | `src/patterns/observer/`                              | Task events broadcast to subscribers          |
| Factory   | `src/patterns/factory/`                               | Builds notification objects by type           |

## Setup

```bash
# 1. Install deps
pnpm install

# 2. Configure env
cp .env.example .env
# edit DATABASE_URL + JWT_SECRET

# 3. Create database, then:
pnpm db:migrate

# 4. Run
pnpm dev
```

API base URL: `http://localhost:4000/api`

## Inspecting the DB

```bash
pnpm db:studio
```

## Routes

| Method | Path                              | Auth | Description                |
|--------|-----------------------------------|------|----------------------------|
| GET    | `/api/health`                     | —    | Liveness check             |
| POST   | `/api/auth/register`              | —    | `{ name, email, password }` |
| POST   | `/api/auth/login`                 | —    | `{ email, password }`      |
| GET    | `/api/auth/me`                    | ✓    | Current user               |
| GET    | `/api/boards`                     | ✓    | List boards for user       |
| POST   | `/api/boards`                     | ✓    | `{ title }`                |
| POST   | `/api/tasks`                      | ✓    | Create task                |
| PATCH  | `/api/tasks/:id/move`             | ✓    | `{ toColumnId }`           |
| GET    | `/api/tasks/by-column/:columnId`  | ✓    | List column tasks          |

## Smoke test

```bash
# 1. Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"a@b.com","password":"password123"}'
# → { user: {...}, token: "..." }

# 2. Create a board (paste the token from step 1)
TOKEN="..."
curl -X POST http://localhost:4000/api/boards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My first board"}'
# → board with 3 columns (To Do / In Progress / Done)

# 3. Create a task in the "To Do" column (use the column id from step 2)
curl -X POST http://localhost:4000/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"columnId":"<COL_ID>","title":"Buy milk","priority":"HIGH"}'
# → task created, AND observers fire (check server logs for in-app log line)
```
