import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/auth.service", () => {
  return {
    AuthService: {
      register: vi.fn(),
      login: vi.fn(),
    },
  };
});

vi.mock("../../src/middleware/auth.middleware", () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: "u1", name: "Test User", email: "test@example.com", createdAt: new Date() };
    next();
  },
}));

import { createApp } from "../../src/app";
import { AuthService } from "../../src/services/auth.service";
import { HttpError } from "../../src/middleware/error.middleware";

const app = createApp();

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Auth routes - integration (mocked services)", () => {
  it("register - success returns 201 with user and token", async () => {
    (AuthService.register as any).mockResolvedValue({
      user: { id: "u1", name: "T", email: "t@t.com", createdAt: new Date() },
      token: "tok",
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "T", email: "t@t.com", password: "password123" })
      .expect(201);

    expect(res.body).toHaveProperty("user");
    expect(res.body).toHaveProperty("token");
  });

  it("register - duplicate email returns 409", async () => {
    (AuthService.register as any).mockRejectedValue(new HttpError(409, "Email already registered"));

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "T", email: "t@t.com", password: "password123" })
      .expect(409);

    expect(res.body).toEqual({ error: "Email already registered" });
  });

  it("login - success returns user and token", async () => {
    (AuthService.login as any).mockResolvedValue({
      user: { id: "u1", name: "T", email: "t@t.com", createdAt: new Date() },
      token: "tok",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "t@t.com", password: "password123" })
      .expect(200);

    expect(res.body).toHaveProperty("user");
    expect(res.body).toHaveProperty("token");
  });

  it("me - returns current user when authenticated", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer faketoken")
      .expect(200);

    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("email");
  });
});
