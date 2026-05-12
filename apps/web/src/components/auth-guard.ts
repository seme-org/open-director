export const signinDialogState = {
  isOpen: false,
  redirectUrl: undefined as string | undefined,
  listeners: new Set<() => void>(),
};

function notify() {
  for (const listener of signinDialogState.listeners) {
    listener();
  }
}

export function subscribeSigninDialog(listener: () => void) {
  signinDialogState.listeners.add(listener);
  return () => {
    signinDialogState.listeners.delete(listener);
  };
}

export function openSigninDialog(redirectUrl?: string) {
  signinDialogState.isOpen = true;
  signinDialogState.redirectUrl = redirectUrl;
  notify();
}

export function closeSigninDialog() {
  signinDialogState.isOpen = false;
  signinDialogState.redirectUrl = undefined;
  notify();
}

export async function fetchCurrentSession() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) return { user: null };
  return (await response.json()) as { user: { id: string } | null };
}

export async function assertCanSubmit(fetchSession = fetchCurrentSession, redirectUrl?: string) {
  const session = await fetchSession();
  if (!session.user?.id) {
    openSigninDialog(redirectUrl);
    return false;
  }
  return true;
}

export function openSigninDialogForUnauthorized(response: Response, redirectUrl?: string) {
  if (response.status !== 401) return false;
  openSigninDialog(redirectUrl);
  return true;
}
