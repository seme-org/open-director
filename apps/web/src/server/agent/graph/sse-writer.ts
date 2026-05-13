import { sleep } from "@/server/agent/utils/text-stream";

type SSEWriterOptions = {
  requestId?: string;
};

export class SSEWriter {
  private controller: ReadableStreamDefaultController;
  private encoder = new TextEncoder();
  private closed = false;
  private requestId: string;

  constructor(controller: ReadableStreamDefaultController, options: SSEWriterOptions = {}) {
    this.controller = controller;
    this.requestId = options.requestId || "unknown";
  }

  isClosed() {
    return this.closed;
  }

  markClosed(reason: string) {
    if (!this.closed) {
      this.closed = true;
      console.warn(`[sse:${this.requestId}] stream marked closed`, { reason });
    }
  }

  write(event: string, data: unknown) {
    if (this.closed) return false;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    try {
      this.controller.enqueue(this.encoder.encode(payload));
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.closed = true;
      console.warn(`[sse:${this.requestId}] write failed; marking stream closed`, {
        event,
        error,
      });
      return false;
    }
  }

  async writeText(id: string, text: string, delay = 18) {
    if (!this.write("text-start", { id })) return;
    const chars = Array.from(text);
    for (const char of chars) {
      if (!this.write("text-delta", { id, delta: char })) return;
      if (delay > 0) await sleep(delay);
    }
    this.write("text-end", { id });
  }

  async close() {
    if (this.closed) return;
    if (!this.write("done", {})) return;
    // Wait for data to flush before closing the stream
    await sleep(50);
    try {
      this.controller.close();
      this.closed = true;
    } catch (err) {
      // controller may already be closed
      this.closed = true;
      const error = err instanceof Error ? err.message : String(err);
      console.warn(`[sse:${this.requestId}] close failed; stream already closed`, { error });
    }
  }
}
