import { describe, expect, it, vi } from "vitest";

import { scheduleMicrotask } from "./task";

describe("shared/utils/task/scheduleMicrotask", () => {
  it("invokes the task on the microtask queue", async () => {
    const task = vi.fn();

    scheduleMicrotask(task);

    expect(task).not.toHaveBeenCalled();

    await Promise.resolve();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("falls back to a Promise microtask when queueMicrotask is unavailable", async () => {
    try {
      vi.stubGlobal("queueMicrotask", undefined);

      const task = vi.fn();
      scheduleMicrotask(task);

      expect(task).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(task).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
