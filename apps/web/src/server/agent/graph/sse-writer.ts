import { sleep } from "@/server/agent/utils/text-stream";

export class SSEWriter {
  private controller: ReadableStreamDefaultController;
  private encoder = new TextEncoder();

  constructor(controller: ReadableStreamDefaultController) {
    this.controller = controller;
  }

  write(event: string, data: unknown) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.controller.enqueue(this.encoder.encode(payload));
  }

  async writeText(id: string, text: string, delay = 18) {
    this.write("text-start", { id });
    const chars = Array.from(text);
    for (const char of chars) {
      this.write("text-delta", { id, delta: char });
      if (delay > 0) await sleep(delay);
    }
    this.write("text-end", { id });
  }

  async close() {
    this.write("done", {});
    // Wait for data to flush before closing the stream
    await sleep(50);
    try {
      this.controller.close();
    } catch {
      // controller may already be closed
    }
  }
}
