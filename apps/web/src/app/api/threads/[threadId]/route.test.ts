import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const updateMany = vi.fn();

vi.mock("@/server/auth/session", () => ({
  getCurrentUser,
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    thread: {
      updateMany,
    },
  },
}));

describe("DELETE /api/threads/[threadId]", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    updateMany.mockReset();
  });

  it("rejects deletion when the user is not signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { DELETE } = await import("./route");

    const response = await DELETE(new Request("http://localhost/api/threads/thread-1", { method: "DELETE" }), {
      params: Promise.resolve({ threadId: "thread-1" }),
    });

    expect(response.status).toBe(401);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("soft deletes the current user's thread", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1" });
    updateMany.mockResolvedValue({ count: 1 });
    const { DELETE } = await import("./route");

    const response = await DELETE(new Request("http://localhost/api/threads/thread-1", { method: "DELETE" }), {
      params: Promise.resolve({ threadId: "thread-1" }),
    });

    expect(response.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "thread-1",
        userId: "user-1",
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: expect.any(Date),
      },
    });
  });
});
