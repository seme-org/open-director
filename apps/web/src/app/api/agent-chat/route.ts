import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { getCurrentUser } from "@/server/auth/session";
import { graph } from "@/server/agent/graph/graph";
import { SSEWriter } from "@/server/agent/graph/sse-writer";
import { isCreateVideoCommand } from "@/server/agent/utils/commands";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const last = messages[messages.length - 1];
  const directorBrief = body.directorBrief && typeof body.directorBrief === "object"
    ? body.directorBrief as Record<string, unknown>
    : {};

  const confirmDirectorBrief = body.confirmDirectorBrief === true;
  const originalPrompt = String(body.prompt ?? "").trim();
  const prompt = confirmDirectorBrief
    ? String(directorBrief.project_name || directorBrief.title || originalPrompt || "").trim()
    : originalPrompt;

  if (!prompt) {
    return new Response("Missing prompt", { status: 400 });
  }

  let threadId = String(body.threadId || "").trim();
  if (!threadId) {
    const thread = await prisma.thread.create({
      data: { title: prompt.slice(0, 80), description: prompt, userId: user.id },
    });
    threadId = thread.id;
  }

  // Save user message
  if (confirmDirectorBrief) {
    await prisma.message.create({
      data: {
        threadId,
        userId: user.id,
        role: "user",
        content: "",
        parts: JSON.parse(JSON.stringify([{ type: "text", text: prompt }])) as Prisma.InputJsonValue,
      },
    });
  } else {
    await prisma.message.create({
      data: {
        threadId,
        userId: user.id,
        role: "user",
        content: prompt,
        parts: last ? (JSON.parse(JSON.stringify([last])) as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  const startNode = confirmDirectorBrief ? "recipe_node"
    : isCreateVideoCommand(prompt) ? "runner_executor"
    : "director_node";

  const collectedParts: unknown[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const writer = new SSEWriter(controller);

      // Wrap write to collect parts for persistence
      const originalWrite = writer.write.bind(writer);
      writer.write = (event: string, data: unknown) => {
        originalWrite(event, data);
        if (event === "agent-status" || event === "runner-progress" || event === "done" || event === "error") return;
        // Deduplicate recipe and media-assets events: keep only the latest
        if (event === "recipe" || event === "media-assets") {
          for (let i = collectedParts.length - 1; i >= 0; i--) {
            if ((collectedParts[i] as { type: string }).type === event) {
              collectedParts.splice(i, 1);
            }
          }
        }
        collectedParts.push({ type: event, data });
      };

      writer.write("agent-status", { node: "init", status: "running" });

      try {
        await graph.invoke(
          {
            goal: prompt,
            threadId,
            userId: user.id,
            startNode,
            directorBrief: confirmDirectorBrief ? directorBrief : undefined,
            needsConfirmation: !confirmDirectorBrief,
          },
          {
            configurable: {
              thread_id: threadId,
              writer,
            },
            recursionLimit: 100,
          },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[agent-chat] graph error:", message);
        try {
          writer.write("error", { message });
          await writer.writeText("error-text", `Error: ${message}`, 0);
        } catch {}
      } finally {
        try { await writer.close(); } catch {}

        // Persist assistant message
        if (collectedParts.length) {
          try {
            if (confirmDirectorBrief) {
              // Merge into the existing director-brief assistant message
              const existing = await prisma.message.findFirst({
                where: { threadId, role: "assistant" },
                orderBy: { createdAt: "desc" },
              });
              if (existing && Array.isArray(existing.parts)) {
                const existingParts = existing.parts as Record<string, unknown>[];
                const kept = existingParts.filter(
                  (p) => p.type !== "recipe" && p.type !== "media-assets",
                );
                const mergedParts = [...kept, ...collectedParts];
                await prisma.message.update({
                  where: { id: existing.id },
                  data: { parts: JSON.parse(JSON.stringify(mergedParts)) as Prisma.InputJsonValue },
                });
              } else {
                await prisma.message.create({
                  data: {
                    threadId,
                    userId: user.id,
                    role: "assistant",
                    content: "",
                    parts: JSON.parse(JSON.stringify(collectedParts)) as Prisma.InputJsonValue,
                    metadata: JSON.parse(JSON.stringify({
                      source: "langgraph",
                      agent: "open-director",
                      prompt,
                    })) as Prisma.InputJsonValue,
                  },
                });
              }
            } else {
              await prisma.message.create({
                data: {
                  threadId,
                  userId: user.id,
                  role: "assistant",
                  content: "",
                  parts: JSON.parse(JSON.stringify(collectedParts)) as Prisma.InputJsonValue,
                  metadata: JSON.parse(JSON.stringify({
                    source: "langgraph",
                    agent: "open-director",
                    prompt,
                  })) as Prisma.InputJsonValue,
                },
              });
            }
          } catch (err) {
            console.error("[agent-chat] failed to persist assistant message:", err);
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
