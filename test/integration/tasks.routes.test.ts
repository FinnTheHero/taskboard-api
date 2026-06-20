import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/task.service.js", () => ({
  TaskService: {
    create: vi.fn(),
    move: vi.fn(),
    listByColumn: vi.fn(),
    assign: vi.fn(),
  },
}));

vi.mock("../../src/services/board.service.js", () => ({
  BoardService: {
    listForUser: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    archiveCompletedTasks: vi.fn(),
    grantAccess: vi.fn(),
    revokeAccess: vi.fn(),
    listBoardMembers: vi.fn(),
    listAssignableMembers: vi.fn(),
  },
}));

vi.mock("../../src/middleware/auth.middleware.js", () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      createdAt: new Date(),
    };
    next();
  },
}));

import { createApp } from "../../src/app.js";
import { TaskService } from "../../src/services/task.service.js";
import { BoardService } from "../../src/services/board.service.js";
import { HttpError } from "../../src/middleware/error.middleware.js";

const app = createApp();

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Task assign routes", () => {
  it("PATCH /tasks/:id/assign succeeds", async () => {
    (TaskService.assign as any).mockResolvedValue({
      id: "t1",
      columnId: "c1",
      title: "Fix bug",
      assigneeId: "u2",
      assignee: { id: "u2", name: "Bob", email: "bob@demo.com" },
    });

    const res = await request(app)
      .patch("/api/tasks/t1/assign")
      .send({ assigneeId: "u2" })
      .expect(200);

    expect(res.body.assigneeId).toBe("u2");
    expect(res.body.assignee.name).toBe("Bob");
  });

  it("PATCH /tasks/:id/assign returns 403 for invalid assignee", async () => {
    (TaskService.assign as any).mockRejectedValue(
      new HttpError(403, "Assignee must have access to this board"),
    );

    const res = await request(app)
      .patch("/api/tasks/t1/assign")
      .send({ assigneeId: "u99" })
      .expect(403);

    expect(res.body.error).toContain("Assignee must have access");
  });

  it("PATCH /tasks/:id/assign allows unassign", async () => {
    (TaskService.assign as any).mockResolvedValue({
      id: "t1",
      columnId: "c1",
      title: "Fix bug",
      assigneeId: null,
      assignee: null,
    });

    const res = await request(app)
      .patch("/api/tasks/t1/assign")
      .send({ assigneeId: null })
      .expect(200);

    expect(res.body.assigneeId).toBeNull();
  });
});

describe("Assignable members route", () => {
  it("GET /boards/:id/assignable-members returns members for board access", async () => {
    (BoardService.listAssignableMembers as any).mockResolvedValue([
      {
        boardId: "b1",
        userId: "u1",
        user: { id: "u1", name: "Alice", email: "alice@demo.com" },
      },
      {
        boardId: "b1",
        userId: "u2",
        user: { id: "u2", name: "Bob", email: "bob@demo.com" },
      },
    ]);

    const res = await request(app)
      .get("/api/boards/b1/assignable-members")
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body[0].user.name).toBe("Alice");
  });
});
