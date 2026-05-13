import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { DirectorRecipe } from "@/server/agent/schemas/recipe";
import type { RunnerTask } from "@/server/agent/media-provider";
import { emptyResearchNotes, type ResearchNotes } from "@/server/agent/schemas/research";

export const DirectorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  goal: Annotation<string>(),
  threadId: Annotation<string>(),
  userId: Annotation<string>(),

  directorBrief: Annotation<Record<string, unknown>>(),
  needsConfirmation: Annotation<boolean>(),

  research: Annotation<ResearchNotes>({
    reducer: (_prev, next) => next,
    default: () => emptyResearchNotes,
  }),

  recipe: Annotation<DirectorRecipe>(),
  recipeId: Annotation<string>(),

  blocks: Annotation<Record<string, unknown>[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  runnerTasks: Annotation<RunnerTask[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  mediaAssets: Annotation<Record<string, unknown>[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  startNode: Annotation<string>(),
  currentStep: Annotation<string>(),
  error: Annotation<string>(),
});
