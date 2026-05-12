export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunkAssistantText(text: string, chunkSize = 8) {
  const characters = Array.from(text);
  const chunks: string[] = [];
  for (let index = 0; index < characters.length; index += chunkSize) {
    chunks.push(characters.slice(index, index + chunkSize).join(""));
  }
  return chunks;
}

export type TextStreamWriter = {
  write(event: string, data: unknown): void;
};

export async function writeAssistantText(
  writer: TextStreamWriter,
  id: string,
  text: string,
  options: { chunkSize?: number; delayMs?: number } = {},
) {
  writer.write("text-start", { id });
  const delayMs = options.delayMs ?? 18;
  for (const delta of chunkAssistantText(text, options.chunkSize ?? 8)) {
    writer.write("text-delta", { id, delta });
    if (delayMs > 0) await sleep(delayMs);
  }
  writer.write("text-end", { id });
}
