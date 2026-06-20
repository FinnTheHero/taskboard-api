import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/stats.service.js", () => ({
  StatsService: {
    getBoardStats: vi.fn(),
    getGroupStats: vi.fn(),
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
import { StatsService } from "../../src/services/stats.service.js";
import { HttpError } from "../../src/middleware/error.middleware.js";

const app = createApp();

const sampleBoardStats = {
  boardId: "b1",
  totalTasks: 10,
  doneCount: 3,
  completionRate: 30,
  overdueCount: 2,
  unassignedCount: 1,
  tasksByPriority: { HIGH: 2, MEDIUM: 5 },
  tasksByColumn: [
    { column: "To Do", count: 4 },
    { column: "In Progress", count: 3 },
    { column: "Done", count: 3 },
  ],
  byAssignee: [
    { userId: "u1", name: "Alice", taskCount: 5, overdueCount: 1 },
  ],
  avgTimeInColumn: [
    { column: "To Do", avgHours: 12.5 },
    { column: "In Progress", avgHours: 8 },
    { column: "Done", avgHours: 2 },
  ],
};

const sampleGroupStats = {
  groupId: "g1",
  groupName: "Acme Corp",
  boardCount: 2,
  accessibleBoardCount: 1,
  totalTasks: 10,
  doneCount: 3,
  completionRate: 30,
  overdueCount: 2,
  unassignedCount: 1,
  tasksByPriority: { HIGH: 2, MEDIUM: 5 },
  tasksByColumn: [
    { column: "To Do", count: 4 },
    { column: "In Progress", count: 3 },
    { column: "Done", count: 3 },
  ],
  byAssignee: [
    { userId: "u1", name: "Alice", taskCount: 5, overdueCount: 1 },
  ],
  avgTimeInColumn: [
    { column: "To Do", avgHours: 12.5 },
  ],
  byBoard: [
    {
      boardId: "b1",
      title: "Sprint Board",
      totalTasks: 10,
      completionRate: 30,
      overdueCount: 2,
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Board stats routes", () => {
  it("GET /boards/:id/stats returns board metrics", async () => {
    (StatsService.getBoardStats as any).mockResolvedValue(sampleBoardStats);

    const res = await request(app).get("/api/boards/b1/stats").expect(200);

    expect(res.body.boardId).toBe("b1");
    expect(res.body.completionRate).toBe(30);
    expect(res.body.tasksByColumn).toHaveLength(3);
    expect(res.body.byAssignee).toHaveLength(1);
  });

  it("GET /boards/:id/stats returns 403 without board access", async () => {
    (StatsService.getBoardStats as any).mockRejectedValue(
      new HttpError(403, "You do not have access to this board"),
    );

    const res = await request(app).get("/api/boards/b1/stats").expect(403);
    expect(res.body.error).toContain("access");
  });
});

describe("Group stats routes", () => {
  it("GET /groups/stats returns group metrics", async () => {
    (StatsService.getGroupStats as any).mockResolvedValue(sampleGroupStats);

    const res = await request(app).get("/api/groups/stats").expect(200);

    expect(res.body.groupName).toBe("Acme Corp");
    expect(res.body.boardCount).toBe(2);
    expect(res.body.accessibleBoardCount).toBe(1);
    expect(res.body.byBoard).toHaveLength(1);
    expect(res.body.totalTasks).toBe(10);
  });

  it("GET /groups/stats returns 403 when not in a group", async () => {
    (StatsService.getGroupStats as any).mockRejectedValue(
      new HttpError(403, "You must join a group first"),
    );

    const res = await request(app).get("/api/groups/stats").expect(403);
    expect(res.body.error).toContain("group");
  });
});
