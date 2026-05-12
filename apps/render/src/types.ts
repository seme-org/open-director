export type AudioAsset = {
  asset_id?: string;
  duration?: number;
  type?: string;
  url?: string;
  block_id?: string;
  text?: string;
  order?: number;
  subtitleTimings?: Array<{
    text: string;
    start: number;
    end: number;
  }>;
};

export type AssetItem = {
  audio?: AudioAsset[];
  sub_title?: { text: string };
  video?: { url: string; duration?: number };
  image?: { url: string };
  visual_effect_parameters?: string;
  videoPath?: string;
  imagePath?: string;
  audioPath?: string;
  audioPaths?: string[];
  audioDurations?: number[];
  audioSpeed?: number;
  probedVideoDuration?: number;
  probedAudioDuration?: number;
  probedWidth?: number;
  probedHeight?: number;
};

export type InputParameter = {
  intent?: string;
  sub_intent?: string;
  parameters?: {
    duration?: number;
    aspect_ratio?: string;
    charactersOrSubjects?: any[];
  };
  advancedParameters?: {
    style?: string;
    styleImage?: string;
    imageModel?: string;
    videoModel?: string;
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

export type VideoUser = {
  id?: string;
  email?: string;
  name?: string;
  image?: string;
};

export type RenderJobInput = {
  threadId?: string;
  messageId?: string;
  userId?: string;
  batchId?: string;
  batchItemId?: string;
  batchOutputIndex?: number;
  title?: string;
  narration_audio?: AudioAsset;
  items: AssetItem[];
  bg_audios?: { url: string; volume?: number }[];
  input_parameter?: InputParameter;
  aspect_ratio?: string;
  resolution?: 480 | 720 | 1080;
  user?: VideoUser;
  isFreeUser?: boolean;
  asyncTaskId?: string;
};
