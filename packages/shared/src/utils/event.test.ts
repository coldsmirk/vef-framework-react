import { describe, expect, it, vi } from "vitest";

import { createEventEmitter, EventEmitter } from "./event";

interface DemoEvents extends Record<string, unknown> {
  message: { text: string };
  pulse: undefined;
}

describe("shared/utils/event/EventEmitter", () => {
  describe("on / emit / off", () => {
    it("delivers payloads to subscribers", () => {
      const emitter = createEventEmitter<DemoEvents>();
      const handler = vi.fn();
      emitter.on("message", handler);

      emitter.emit("message", { text: "hi" });

      expect(handler).toHaveBeenCalledWith({ text: "hi" });
    });

    it("returns an unsubscribe function that prevents future deliveries", () => {
      const emitter = createEventEmitter<DemoEvents>();
      const handler = vi.fn();
      const unsubscribe = emitter.on("message", handler);

      unsubscribe();
      emitter.emit("message", { text: "lost" });

      expect(handler).not.toHaveBeenCalled();
    });

    it("delivers payloadless events when emitted without a payload argument", () => {
      const emitter = createEventEmitter<DemoEvents>();
      const handler = vi.fn();
      emitter.on("pulse", handler);

      emitter.emit("pulse");

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("removes a specific handler via off when provided", () => {
      const emitter = createEventEmitter<DemoEvents>();
      const keptHandler = vi.fn();
      const removedHandler = vi.fn();

      emitter.on("message", keptHandler);
      emitter.on("message", removedHandler);
      emitter.off("message", removedHandler);
      emitter.emit("message", { text: "broadcast" });

      expect(keptHandler).toHaveBeenCalledTimes(1);
      expect(removedHandler).not.toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("removes every listener across every event", () => {
      const emitter = createEventEmitter<DemoEvents>();
      const handler = vi.fn();
      emitter.on("message", handler);

      emitter.clear();
      emitter.emit("message", { text: "cleared" });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("getAllListeners", () => {
    it("exposes the registered listeners for inspection", () => {
      const emitter = createEventEmitter<DemoEvents>();
      const handler = vi.fn();
      emitter.on("message", handler);

      const listeners = emitter.getAllListeners();
      const messageHandlers = listeners.get("message");

      expect(messageHandlers).toBeDefined();
      expect(messageHandlers).toHaveLength(1);
    });
  });

  describe("createEventEmitter factory", () => {
    it("returns an EventEmitter instance", () => {
      expect(createEventEmitter()).toBeInstanceOf(EventEmitter);
    });
  });
});
