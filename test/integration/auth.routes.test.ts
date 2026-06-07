import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/auth.service.js", () => {
  return {
    AuthService: {
      register: vi.fn(),
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    },
  };
});

vi.mock("../../src/middleware/auth.middleware.js", () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: "u1", name: "Test User", email: "test@example.com", createdAt: new Date() };
    next();
  },
}));

import { createApp } from "../../src/app.js";
import { AuthService } from "../../src/services/auth.service.js";
import { HttpError } from "../../src/middleware/error.middleware.js";

const app = createApp();

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Auth routes - integration (mocked services)", () => {
  it("register - success returns 201 with user and tokens", async () => {
    (AuthService.register as any).mockResolvedValue({
      user: { id: "u1", name: "T", email: "t@t.com", createdAt: new Date() },
      accessToken: "access",
      refreshToken: "refresh",
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "T", email: "t@t.com", password: "password123" })
      .expect(201);

    expect(res.body).toHaveProperty("user");
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
  });

  it("register - duplicate email returns 409", async () => {
    (AuthService.register as any).mockRejectedValue(new HttpError(409, "Email already registered"));

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "T", email: "t@t.com", password: "password123" })
      .expect(409);

    expect(res.body).toEqual({ error: "Email already registered" });
  });

  it("login - success returns user and tokens", async () => {
    (AuthService.login as any).mockResolvedValue({
      user: { id: "u1", name: "T", email: "t@t.com", createdAt: new Date() },
      accessToken: "access",
      refreshToken: "refresh",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "t@t.com", password: "password123" })
      .expect(200);

    expect(res.body).toHaveProperty("user");
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("refreshToken");
  });

  it("refresh - success returns new token pair", async () => {
    (AuthService.refresh as any).mockResolvedValue({
      user: { id: "u1", name: "T", email: "t@t.com", createdAt: new Date() },
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "old-refresh" })
      .expect(200);

    expect(res.body).toHaveProperty("accessToken", "new-access");
    expect(res.body).toHaveProperty("refreshToken", "new-refresh");
  });

  it("logout - returns 204", async () => {
    (AuthService.logout as any).mockResolvedValue(undefined);

    await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: "refresh" })
      .expect(204);
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
