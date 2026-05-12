export type HeaderSessionStatus = "loading" | "authenticated" | "unauthenticated";

export type HeaderSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export type HeaderUserState =
  | { kind: "loading" }
  | { kind: "signin" }
  | { kind: "user"; user: HeaderSessionUser };

export function getHeaderUserState(status: HeaderSessionStatus, user: HeaderSessionUser | null): HeaderUserState {
  if (status === "loading") return { kind: "loading" };
  if (status === "authenticated" && user?.id) return { kind: "user", user };
  return { kind: "signin" };
}
