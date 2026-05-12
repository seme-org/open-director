import { Queue } from "bullmq";
import IORedis from "ioredis";

export type RenderJobInput = {
  threadId?: string;
  messageId?: string;
  userId?: string;
  batchId?: string;
  batchItemId?: string;
  batchOutputIndex?: number;
  title?: string;
  narration_audio?: {
    url: string;
    text?: string;
    duration?: number;
    subtitleTimings?: Array<{
      text: string;
      start: number;
      end: number;
    }>;
  };
  items: Array<{
    audio?: Array<{
      url?: string;
      text?: string;
      duration?: number;
    }>;
    image?: { url: string };
    video?: { url: string; duration?: number };
    sub_title?: { text: string };
  }>;
  bg_audios?: Array<{ url: string; volume?: number }>;
  input_parameter?: {
    advancedParameters?: {
      isGenerateTransition?: "yes" | "no";
      isGenerateVideoEffect?: "yes" | "no";
      isGenerateTitle?: "yes" | "no";
      isGenerateSubtitle?: "yes" | "no";
      isGenerateTitleAnimation?: "yes" | "no";
      isGenerateSubtitleAnimation?: "yes" | "no";
      titleAnimation?: string;
      subtitleAnimation?: string;
      titleStyle?: string;
      subtitleStyle?: string;
      videoEffectStyle?: string;
      transitionStyle?: string;
    };
  };
  aspect_ratio?: string;
  resolution?: 480 | 720 | 1080;
  isFreeUser?: boolean;
};

export const renderQueueName = process.env.RENDER_QUEUE_NAME || "open-director-render";

export function createRedisConnection() {
  return new IORedis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  });
}

export function createRenderQueue() {
  return new Queue<RenderJobInput>(renderQueueName, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
}
