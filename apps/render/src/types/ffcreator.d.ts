declare module "ffcreator" {
  export class FFCreator {
    constructor(options: Record<string, unknown>);
    setConf(key: string, value: unknown): void;
    addChild(scene: FFScene): void;
    on(event: "complete" | "error" | string, callback: (payload?: unknown) => void): void;
    start(): void;
  }

  export class FFScene {
    setBgColor(color: string): void;
    setDuration(seconds: number): void;
    addChild(child: unknown): void;
  }

  export class FFText {
    constructor(options: Record<string, unknown>);
  }

  export const FFmpegUtil: {
    setFFPath(): void;
  };
}
