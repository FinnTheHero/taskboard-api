import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/group.service.js", () => ({
  GroupService: {
    getMembership: vi.fn(),
    join: vi.fn(),
    listMembers: vi.fn(),
    addMemberByEmail: vi.fn(),
    removeMember: vi.fn(),
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
import { GroupService } from "../../src/services/group.service.js";
import { BoardService } from "../../src/services/board.service.js";
import { HttpError } from "../../src/middleware/error.middleware.js";

const app = createApp();

const demoGroup = {
  id: "g1",
  name: "Acme Corp",
  joinCode: "100001",
  createdAt: new Date(),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Group routes", () => {
  it("GET /groups/me returns null when not in a group", async () => {
    (GroupService.getMembership as any).mockResolvedValue(null);

    const res = await request(app).get("/api/groups/me").expect(200);
    expect(res.body).toEqual({ group: null, role: null });
  });

  it("POST /groups/join succeeds with valid code", async () => {
    (GroupService.join as any).mockResolvedValue({
      group: demoGroup,
      role: "MEMBER",
    });

    const res = await request(app)
      .post("/api/groups/join")
      .send({ joinCode: "100001" })
      .expect(201);

    expect(res.body.role).toBe("MEMBER");
    expect(res.body.group.joinCode).toBe("100001");
  });

  it("POST /groups/join returns 409 when already in group", async () => {
    (GroupService.join as any).mockRejectedValue(
      new HttpError(409, "Already a member of a group"),
    );

    const res = await request(app)
      .post("/api/groups/join")
      .send({ joinCode: "100001" })
      .expect(409);

    expect(res.body.error).toBe("Already a member of a group");
  });
});

describe("Board RBAC routes", () => {
  it("GET /boards returns summaries with hasAccess", async () => {
    (BoardService.listForUser as any).mockResolvedValue([
      { id: "b1", title: "Sprint", groupId: "g1", hasAccess: true },
      { id: "b2", title: "Roadmap", groupId: "g1", hasAccess: false },
    ]);

    const res = await request(app).get("/api/boards").expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[1].hasAccess).toBe(false);
  });

  it("GET /boards/:id returns 403 without access", async () => {
    (BoardService.getById as any).mockRejectedValue(
      new HttpError(403, "You do not have access to this board"),
    );

    const res = await request(app).get("/api/boards/b1").expect(403);
    expect(res.body.error).toContain("access");
  });

  it("POST /boards/:id/archive-completed requires manager", async () => {
    (BoardService.archiveCompletedTasks as any).mockRejectedValue(
      new HttpError(403, "Manager role required"),
    );

    const res = await request(app)
      .post("/api/boards/b1/archive-completed")
      .expect(403);

    expect(res.body.error).toBe("Manager role required");
  });

  it("POST /boards/:id/members grants access", async () => {
    (BoardService.grantAccess as any).mockResolvedValue({
      boardId: "b1",
      userId: "u2",
      user: { id: "u2", name: "Bob", email: "bob@demo.com" },
    });

    const res = await request(app)
      .post("/api/boards/b1/members")
      .send({ userId: "u2" })
      .expect(201);

    expect(res.body.userId).toBe("u2");
  });
});
