import type { FFCreator } from "ffcreator";

export function registerCustomEffects(
  creator: FFCreator,
  width: number,
  height: number,
) {
  creator.createEffect("mini_zoom", {
    from: { scale: 1.0 },
    to: { scale: 1.15 },
  });

  creator.createEffect("ken_burns", {
    from: { scale: 1.1, x: width / 2, y: height / 2 },
    to: { scale: 1.3, x: width / 2 - 50, y: height / 2 },
    delay: 0,
    ease: "Linear.None",
  });
}

export function applyCameraShake(
  node: any,
  duration: number = 3,
  magnitude: number = 10,
  frequency: number = 3,
) {
  const startScale = 1.2;
  node.setScale(startScale);

  const originX = node.conf.x;
  const originY = node.conf.y;

  const stepTime = 0.04;
  const steps = Math.floor(duration / stepTime);
  let currentTime = 0;

  for (let i = 0; i < steps; i++) {
    const offsetX = Math.sin(currentTime * frequency) * magnitude;
    const offsetY = Math.cos(currentTime * frequency * 0.8) * magnitude;
    const rotation =
      Math.sin(currentTime * frequency * 0.5) * ((2 * Math.PI) / 180);

    node.addAnimate({
      from:
        i === 0 ? { x: originX, y: originY, rotate: 0 } : undefined,
      to: {
        x: originX + offsetX,
        y: originY + offsetY,
        rotate: rotation,
        scale: startScale,
      },
      time: stepTime,
      delay: currentTime,
      ease: "Linear.None",
    });

    currentTime += stepTime;
  }

  node.addAnimate({
    to: { x: originX, y: originY, rotate: 0, scale: startScale },
    time: 0.5,
    delay: currentTime,
    ease: "Quadratic.Out",
  });
}
