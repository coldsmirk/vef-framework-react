import { afterEach, beforeEach, vi } from "vitest";

import "@testing-library/jest-dom/vitest";

class ResizeObserver {
  observe() {
    // mock
  }

  unobserve() {
    // mock
  }

  disconnect() {
    // mock
  }
}

class IntersectionObserver {
  observe() {
    // mock
  }

  unobserve() {
    // mock
  }

  disconnect() {
    // mock
  }
}

const global = globalThis as any;

global.ResizeObserver = ResizeObserver;
global.IntersectionObserver = IntersectionObserver;

// jsdom under Node 22 no longer ships a localStorage implementation, so
// any test exercising browser-storage code has to bring its own. The
// polyfill below is in-memory and per-process — safe to share because
// vitest gives each test file an isolated module graph.
class InMemoryStorage implements Storage {
  readonly #map = new Map<string, string>();

  get length(): number {
    return this.#map.size;
  }

  clear(): void {
    this.#map.clear();
  }

  getItem(key: string): string | null {
    return this.#map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#map.set(key, String(value));
  }
}

if (global.localStorage === undefined) {
  const storage = new InMemoryStorage();
  global.localStorage = storage;

  if (global.window !== undefined) {
    global.window.localStorage = storage;
  }
}

// jsdom emits "Not implemented: ..." entries (e.g. getComputedStyle with
// pseudo-elements, navigation, window.scrollTo) through its virtualConsole.
// They're documented gaps in jsdom rather than real bugs in our code, and
// they flood the pre-push test output. Filter them out while keeping every
// other jsdom error visible. `_virtualConsole` is jsdom's documented internal
// hook — we mirror its name verbatim.
// eslint-disable-next-line @typescript-eslint/naming-convention
const virtualConsole = (global.window as { _virtualConsole?: {
  removeAllListeners: (event: string) => void;
  on: (event: string, listener: (err: Error) => void) => void;
}; })?._virtualConsole;

if (virtualConsole) {
  virtualConsole.removeAllListeners("jsdomError");
  virtualConsole.on("jsdomError", (err: Error) => {
    if (typeof err?.message === "string" && err.message.startsWith("Not implemented:")) {
      return;
    }

    console.error(err);
  });
}

Object.defineProperty(global, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    };
  })
});

// jsdom implements neither the Pointer Capture API nor scrollIntoView. antd-mobile
// pickers (Picker / DatePicker wheels via `@use-gesture`, CalendarPicker) call
// these during open / pointer interactions, throwing uncaught errors under jsdom.
// Stub them as no-ops — no behavior is asserted on them.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {
    // jsdom stub: pointer capture is a no-op under test.
  };

  Element.prototype.releasePointerCapture = () => {
    // jsdom stub: pointer capture is a no-op under test.
  };

  Element.prototype.hasPointerCapture = () => false;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {
    // jsdom stub: scrollIntoView is a no-op under test.
  };
}

beforeEach(() => {
  // todo
});

afterEach(() => {
  // Reset shared browser-storage state so a test cannot leak rows into
  // the next file. The Observer mocks above are stateless, so this is
  // the only shared surface that survives between tests.
  global.localStorage?.clear?.();
});
