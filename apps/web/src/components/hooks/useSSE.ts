import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useRef, useCallback, useState } from "react";

interface SSEEvent {
  event: string;
  data: string;
}

interface UseSSEOptions {
  url: string;
  onEvent: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
}

/** Backend has started irreversible work once these events arrive */
const MUTATING_EVENTS = new Set([
  "recipe", "runner-tasks", "media-assets", "runner-progress",
]);

export function useSSE({ url, onEvent, onError }: UseSSEOptions) {
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const abortRef = useRef<AbortController | null>(null);

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const start = useCallback(async (body: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("streaming");

    let hasMutatingEvent = false;

    try {
      await fetchEventSource(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: ctrl.signal,
        onmessage(event) {
          if (event.event === "done") {
            setStatus("done");
            ctrl.abort();
            return;
          }
          if (MUTATING_EVENTS.has(event.event)) {
            hasMutatingEvent = true;
          }
          onEventRef.current({ event: event.event, data: event.data });
        },
        onerror() {
          // Already received mutating events → backend is working → don't retry
          if (hasMutatingEvent) return -1;
          // No mutating events yet → safe to retry (likely network issue)
        },
        onclose() {
          setStatus("done");
        },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      onErrorRef.current?.(err as Error);
    }
  }, [url]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  return { start, abort, status };
}
