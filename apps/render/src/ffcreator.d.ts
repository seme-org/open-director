declare module "ffcreator" {
  interface FFAnimationConf {
    from?: Record<string, any>;
    to?: Record<string, any>;
    ease?: string;
    time?: number;
    delay?: number;
  }

  interface FFAudioConf {
    path: string;
    volume?: number;
    loop?: boolean;
    startTime?: number;
  }

  interface FFNodeCommonConf {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }

  class FFCreator {
    constructor(conf: {
      cacheDir?: string;
      outputDir?: string;
      width?: number;
      height?: number;
      log?: boolean;
      parallel?: number;
      output?: string;
    });
    setConf(key: string, val: any): void;
    getConf(key: string): any;
    addChild(child: FFScene): void;
    addAudio(audio: FFAudio): void;
    start(): void;
    destroy(): void;
    createEffect(name: string, conf: FFAnimationConf): void;
    on(event: string, fn: (...args: any[]) => void): void;
    static setFFPath(): void;
  }

  class FFScene {
    constructor();
    setBgColor(color: string): void;
    setDuration(duration: number): void;
    addChild(child: FFNode): void;
    addAudio(conf: FFAudioConf): void;
    setTransition(name: string, duration: number): void;
  }

  class FFNode {
    constructor(conf?: Record<string, any>);
    setX(x: number): void;
    setY(y: number): void;
    setWidth(w: number): void;
    setHeight(h: number): void;
    setScale(s: number): void;
    setOpacity(o: number): void;
    setAnchor(x: number, y: number): void;
    setRotate(r: number): void;
    addEffect(name: string | string[], duration: number, delay?: number): void;
    addAnimate(conf: {
      from?: Record<string, any>;
      to?: Record<string, any>;
      time?: number;
      delay?: number;
      ease?: string;
    }): void;
  }

  class FFText extends FFNode {
    constructor(conf: {
      text?: string;
      x?: number;
      y?: number;
      fontSize?: number;
      color?: string;
      font?: string;
      style?: Record<string, any>;
    });
    setColor(color: string): void;
    setBackgroundColor(color: string): void;
    setText(text: string): void;
    setStyle(style: any): void;
    setFont(path: string): void;
    alignCenter(): void;
    setWrap(width: number): void;
  }

  class FFImage extends FFNode {
    constructor(conf: {
      path: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    });
  }

  class FFVideo extends FFNode {
    constructor(conf: {
      path: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    });
  }

  class FFRect extends FFNode {
    constructor(conf: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      color?: string;
      opacity?: number;
    });
  }

  class FFAudio {
    constructor(conf: FFAudioConf);
  }

  class FFmpegUtil {
    static setFFPath(): void;
    static setFFprobePath(): void;
  }

  const FFCreatorCenter: {
    addTask(task: FFCreator): void;
    start(): void;
    size(): number;
  };
}
