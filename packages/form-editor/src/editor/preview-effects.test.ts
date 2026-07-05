import type { EffectAction, EffectDispatchContext } from "../types";

import { previewDispatchEffect } from "./preview-effects";

interface MessageMock {
  info: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

/**
 * The `show*Message` helpers dispatch through `globalThis.$vef.message` (set by
 * `<ConfigProvider>` in a real app). Install a mock so the dispatcher can run
 * without mounting the provider.
 */
function installVefMessage(): MessageMock {
  const message: MessageMock = {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  };

  vi.stubGlobal("$vef", { message });

  return message;
}

function contextResolving(resolved?: unknown): EffectDispatchContext {
  return {
    values: {},
    resolveValue: () => resolved
  };
}

describe("previewDispatchEffect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("alert", () => {
    it("shows the resolved message at the action's level", () => {
      const message = installVefMessage();

      previewDispatchEffect(
        {
          type: "alert",
          level: "warning",
          message: { kind: "literal", value: "x" }
        },
        contextResolving("年龄太小")
      );

      expect(message.warning).toHaveBeenCalledWith("年龄太小", expect.anything());
      expect(message.info).not.toHaveBeenCalled();
    });

    it("defaults to info when the level is omitted", () => {
      const message = installVefMessage();

      previewDispatchEffect(
        { type: "alert", message: { kind: "literal", value: "hi" } },
        contextResolving("hello")
      );

      expect(message.info).toHaveBeenCalledWith("hello", expect.anything());
    });
  });

  describe("navigate", () => {
    it("surfaces the destination as an info toast", () => {
      const message = installVefMessage();

      previewDispatchEffect(
        { type: "navigate", to: { kind: "literal", value: "/next" } },
        contextResolving("/next")
      );

      expect(message.info).toHaveBeenCalledWith(expect.stringContaining("/next"), expect.anything());
    });
  });

  describe("api_call", () => {
    it("surfaces the resource and action as an info toast", () => {
      const message = installVefMessage();
      const action: EffectAction = {
        type: "api_call",
        request: { resource: "user", action: "list" }
      };

      previewDispatchEffect(action, contextResolving());

      expect(message.info).toHaveBeenCalledWith(expect.stringContaining("user"), expect.anything());
    });
  });
});
