const pendingPromptPrefix = "open-director-pending-prompt";

export function pendingPromptKey(threadId: string) {
  return `${pendingPromptPrefix}:${threadId}`;
}

export function storePendingPrompt(storage: Pick<Storage, "setItem">, threadId: string, prompt: string) {
  storage.setItem(pendingPromptKey(threadId), prompt);
}

export function takePendingPrompt(storage: Pick<Storage, "getItem" | "removeItem">, threadId: string) {
  const key = pendingPromptKey(threadId);
  const prompt = storage.getItem(key);
  if (prompt) {
    storage.removeItem(key);
  }
  return prompt;
}
