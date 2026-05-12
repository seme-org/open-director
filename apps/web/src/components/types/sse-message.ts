export interface SSEMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: SSEMessagePart[];
  createdAt?: Date;
}

export type SSEMessagePart =
  | { type: "text"; text: string }
  | { type: "data-agent-status"; data: AgentStatusData; transient?: boolean }
  | { type: "data-director-brief"; data: Record<string, unknown> }
  | { type: "data-recipe"; data: Record<string, unknown> }
  | { type: "data-recipe-components"; data: Record<string, unknown> }
  | { type: "data-runner-tasks"; data: { tasks: unknown[] } }
  | { type: "data-runner-progress"; data: RunnerProgressData; transient?: boolean }
  | { type: "data-media-assets"; data: { assets: unknown[] } };

export interface AgentStatusData {
  node: string;
  status: "running" | "completed" | "failed" | "pending";
  next?: string;
  error?: string;
  recipeId?: string;
  blockCount?: number;
  taskCount?: number;
  assetCount?: number;
}

export interface RunnerProgressData {
  taskCount: number;
  completedCount: number;
  failedCount: number;
  running: Array<{ id: string; tool: string; sceneTitle: string }>;
  lastTask: {
    id: string;
    tool: string;
    sceneTitle: string;
    status: "running" | "completed" | "failed";
    assetId?: string;
    error?: string;
  };
}
