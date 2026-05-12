import { describe, expect, it, vi } from "vitest";
import { applyCameraShake, registerCustomEffects } from "./effects.js";

function createMockCreator() {
  return {
    createEffect: vi.fn(),
  };
}

function createMockNode(originX = 960, originY = 540) {
  return {
    setScale: vi.fn(),
    addAnimate: vi.fn(),
    conf: { x: originX, y: originY },
  };
}

describe("registerCustomEffects", () => {
  it("registers mini_zoom and ken_burns effects on the creator", () => {
    const creator = createMockCreator() as any;
    registerCustomEffects(creator, 1920, 1080);

    expect(creator.createEffect).toHaveBeenCalledTimes(2);
    expect(creator.createEffect).toHaveBeenCalledWith(
      "mini_zoom",
      expect.objectContaining({
        from: { scale: 1.0 },
        to: { scale: 1.15 },
      }),
    );
    expect(creator.createEffect).toHaveBeenCalledWith(
      "ken_burns",
      expect.objectContaining({ from: expect.any(Object), to: expect.any(Object) }),
    );
  });
});

describe("applyCameraShake", () => {
  it("sets initial scale to 1.2", () => {
    const node = createMockNode();
    applyCameraShake(node as any, 1, 10, 3);
    expect(node.setScale).toHaveBeenCalledWith(1.2);
  });

  it("generates animation steps based on duration and step time", () => {
    const node = createMockNode();
    applyCameraShake(node as any, 1, 10, 3);
    const calls = node.addAnimate.mock.calls;
    expect(calls.length).toBeGreaterThan(1);
  });

  it("finishes with a return-to-origin animation using Quadratic.Out easing", () => {
    const node = createMockNode(500, 300);
    applyCameraShake(node as any, 1, 10, 3);
    const lastCall = node.addAnimate.mock.calls.at(-1)![0];
    expect(lastCall.to).toEqual(
      expect.objectContaining({ x: 500, y: 300, rotate: 0 }),
    );
    expect(lastCall.ease).toBe("Quadratic.Out");
  });

  it("applies the first step with explicit from position", () => {
    const node = createMockNode(800, 600);
    applyCameraShake(node as any, 0.5, 5, 2);
    const firstCall = node.addAnimate.mock.calls[0]![0];
    expect(firstCall.from).toEqual({ x: 800, y: 600, rotate: 0 });
  });

  it("generates more steps for longer durations", () => {
    const shortNode = createMockNode();
    const longNode = createMockNode();
    applyCameraShake(shortNode as any, 0.5, 10, 3);
    applyCameraShake(longNode as any, 3, 10, 3);
    expect(longNode.addAnimate.mock.calls.length).toBeGreaterThan(
      shortNode.addAnimate.mock.calls.length,
    );
  });
});
