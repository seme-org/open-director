import { describe, expect, it, vi } from "vitest";
import { assertCanSubmit, openSigninDialog, signinDialogState } from "./auth-guard";

describe("auth guard", () => {
  it("opens signin dialog when there is no current user", async () => {
    const fetchSession = vi.fn(async () => ({ user: null }));

    await expect(assertCanSubmit(fetchSession, "/zh-CN/chat")).resolves.toBe(false);

    expect(signinDialogState.isOpen).toBe(true);
    expect(signinDialogState.redirectUrl).toBe("/zh-CN/chat");
  });

  it("allows submission when a user is signed in", async () => {
    signinDialogState.isOpen = false;
    const fetchSession = vi.fn(async () => ({ user: { id: "user-1" } }));

    await expect(assertCanSubmit(fetchSession, "/zh-CN/chat")).resolves.toBe(true);
    expect(signinDialogState.isOpen).toBe(false);
  });

  it("can be opened from a 401 response handler", () => {
    openSigninDialog("/zh-CN");

    expect(signinDialogState.isOpen).toBe(true);
    expect(signinDialogState.redirectUrl).toBe("/zh-CN");
  });
});
