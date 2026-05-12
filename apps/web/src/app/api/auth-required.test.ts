import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();

vi.mock("@/server/auth/session", () => ({
  getCurrentUser,
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    thread: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
  },
}));

describe("auth-required submit routes", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
  });

  it("rejects thread creation when the user is not signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("./threads/route");

    const response = await POST(new Request("http://localhost/api/threads", { method: "POST", body: JSON.stringify({ title: "test" }) }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("rejects agent chat submission when the user is not signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { POST } = await import("./agent-chat/route");

    const response = await POST(new Request("http://localhost/api/agent-chat", { method: "POST", body: JSON.stringify({ prompt: "test" }) }));

    expect(response.status).toBe(401);
  });
});
