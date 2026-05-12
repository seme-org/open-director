import { describe, expect, it } from "vitest";
import { getHeaderUserState } from "./header-user-button-state";

describe("header user button state", () => {
  it("shows loading while the session request is pending", () => {
    expect(getHeaderUserState("loading", null)).toEqual({ kind: "loading" });
  });

  it("shows sign in when there is no authenticated user", () => {
    expect(getHeaderUserState("unauthenticated", null)).toEqual({ kind: "signin" });
  });

  it("shows user details when an authenticated user exists", () => {
    expect(
      getHeaderUserState("authenticated", {
        id: "user-1",
        email: "user@example.com",
        name: "Ada",
        image: "https://example.com/avatar.png",
      }),
    ).toEqual({
      kind: "user",
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "Ada",
        image: "https://example.com/avatar.png",
      },
    });
  });
});
