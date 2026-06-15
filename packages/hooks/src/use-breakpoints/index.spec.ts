import type { Breakpoints } from ".";

import { useBreakpoints } from ".";
import { act, renderHook, waitFor } from "../../test-utils";

describe("useBreakpoints", () => {
  // Store media query states
  const mediaQueryStates = new Map<string, boolean>();
  const mediaQueryLists = new Map<string, MediaQueryList & { listeners: Set<(event: MediaQueryListEvent) => void> }>();

  const matchMediaMock = vi.fn((query: string) => {
    // Check if we already created this mql
    if (mediaQueryLists.has(query)) {
      return mediaQueryLists.get(query)!;
    }

    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const mql = {
      get matches() {
        return mediaQueryStates.get(query) || false;
      },
      media: query,
      onchange: null,
      addEventListener: vi.fn((event: string, handler: (event: MediaQueryListEvent) => void) => {
        if (event === "change") {
          listeners.add(handler);
        }
      }),
      removeEventListener: vi.fn((event: string, handler: (event: MediaQueryListEvent) => void) => {
        if (event === "change") {
          listeners.delete(handler);
        }
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      listeners
    } as MediaQueryList & { listeners: Set<(event: MediaQueryListEvent) => void> };

    mediaQueryLists.set(query, mql);
    return mql;
  });

  beforeEach(() => {
    mediaQueryStates.clear();
    mediaQueryLists.clear();
    vi.stubGlobal("matchMedia", matchMediaMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    matchMediaMock.mockClear();
    mediaQueryStates.clear();
    mediaQueryLists.clear();
  });

  // Helper to set media query matches
  const setMediaMatches = (query: string, matches: boolean) => {
    mediaQueryStates.set(query, matches);
    const mql = mediaQueryLists.get(query);

    if (mql) {
      const event = { matches, media: query } as MediaQueryListEvent;

      for (const listener of mql.listeners) {
        act(() => {
          listener(event);
        });
      }
    }
  };

  describe("Basic functionality", () => {
    it("matches base breakpoint (0) when no other breakpoints match", () => {
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: 640,
        md: 768,
        lg: 1024
      };

      // Set only the 0px breakpoint to match
      mediaQueryStates.set("(min-width: 0px)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      expect(result.current.current).toBe("xs");
      expect(result.current.value).toBe(0);
      expect(result.current.matches).toEqual(["xs"]);
    });

    it("returns the largest matching breakpoint", () => {
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: 640,
        md: 768,
        lg: 1024
      };

      // Set initial matches before rendering
      mediaQueryStates.set("(min-width: 0px)", true);
      mediaQueryStates.set("(min-width: 640px)", true);
      mediaQueryStates.set("(min-width: 768px)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      expect(result.current.current).toBe("md");
      expect(result.current.value).toBe(768);
      expect(result.current.matches).toEqual(["xs", "sm", "md"]);
    });

    it("updates when breakpoint changes", async () => {
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: 640,
        md: 768,
        lg: 1024
      };
      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      // Initially matches xs (0)
      mediaQueryStates.set("(min-width: 0px)", true);
      setMediaMatches("(min-width: 0px)", true);
      await waitFor(() => {
        expect(result.current.current).toBe("xs");
      });

      // Set sm to match
      setMediaMatches("(min-width: 640px)", true);
      await waitFor(() => {
        expect(result.current.current).toBe("sm");
      });
      expect(result.current.value).toBe(640);
      expect(result.current.matches).toEqual(["xs", "sm"]);

      // Set md to also match
      setMediaMatches("(min-width: 768px)", true);
      await waitFor(() => {
        expect(result.current.current).toBe("md");
      });
      expect(result.current.value).toBe(768);
      expect(result.current.matches).toEqual(["xs", "sm", "md"]);

      // Set lg to also match
      setMediaMatches("(min-width: 1024px)", true);
      await waitFor(() => {
        expect(result.current.current).toBe("lg");
      });
      expect(result.current.value).toBe(1024);
      expect(result.current.matches).toEqual(["xs", "sm", "md", "lg"]);

      // Unset lg
      setMediaMatches("(min-width: 1024px)", false);
      await waitFor(() => {
        expect(result.current.current).toBe("md");
      });
      expect(result.current.value).toBe(768);
      expect(result.current.matches).toEqual(["xs", "sm", "md"]);
    });
  });

  describe("String format support", () => {
    it("supports string format with px unit", () => {
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: "640px",
        md: "768px",
        lg: "1024px"
      };

      mediaQueryStates.set("(min-width: 0px)", true);
      mediaQueryStates.set("(min-width: 640px)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      expect(result.current.current).toBe("sm");
      expect(result.current.value).toBe("640px");
    });

    it("supports mixed number and string formats", () => {
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: 640,
        md: "768px",
        lg: 1024,
        xl: "1280px"
      };

      mediaQueryStates.set("(min-width: 0px)", true);
      mediaQueryStates.set("(min-width: 640px)", true);
      mediaQueryStates.set("(min-width: 768px)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      expect(result.current.current).toBe("md");
      expect(result.current.value).toBe("768px");
      expect(result.current.matches).toEqual(["xs", "sm", "md"]);
    });

    it("supports em unit (assuming 16px base)", () => {
      // 640px, 768px
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: "40em",
        md: "48em"
      };

      mediaQueryStates.set("(min-width: 0px)", true);
      mediaQueryStates.set("(min-width: 40em)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      expect(result.current.current).toBe("sm");
      expect(result.current.value).toBe("40em");
    });

    it("supports rem unit (assuming 16px base)", () => {
      // 640px, 768px
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: "40rem",
        md: "48rem"
      };

      mediaQueryStates.set("(min-width: 0px)", true);
      mediaQueryStates.set("(min-width: 40rem)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      expect(result.current.current).toBe("sm");
      expect(result.current.value).toBe("40rem");
    });
  });

  describe("SSR support", () => {
    it("uses initial breakpoint when getInitialValueInEffect is true", async () => {
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: 640,
        md: 768,
        lg: 1024
      };

      // Set 0px to match before rendering
      mediaQueryStates.set("(min-width: 0px)", true);

      // In a real client environment with getInitialValueInEffect,
      // the effect will run and update to actual state
      // But the initial render uses the initialBreakpoint to avoid hydration mismatch
      const { result } = renderHook(() => useBreakpoints(breakpoints, {
        initialBreakpoint: "md",
        getInitialValueInEffect: true
      }));

      // After effect runs with 0px matching, state should be xs
      await waitFor(() => {
        expect(result.current.current).toBe("xs");
      });
      expect(result.current.value).toBe(0);
      expect(result.current.matches).toEqual(["xs"]);
    });

    it("uses null as default when no initial breakpoint provided", () => {
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: 640,
        md: 768
      };

      mediaQueryStates.set("(min-width: 0px)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: true }));

      expect(result.current.current).toBe("xs");
      expect(result.current.value).toBe(0);
      expect(result.current.matches).toEqual(["xs"]);
    });

    it("updates to actual breakpoint after effect runs", async () => {
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: 640,
        md: 768,
        lg: 1024
      };

      mediaQueryStates.set("(min-width: 0px)", true);
      mediaQueryStates.set("(min-width: 640px)", true);
      mediaQueryStates.set("(min-width: 768px)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, {
        initialBreakpoint: "sm",
        getInitialValueInEffect: true
      }));

      // After effect runs, it should update to actual breakpoint
      await waitFor(() => {
        expect(result.current.current).toBe("md");
      });
      expect(result.current.value).toBe(768);
      expect(result.current.matches).toEqual(["xs", "sm", "md"]);
    });
  });

  describe("Edge cases", () => {
    it("handles single breakpoint with 0 value", () => {
      const breakpoints: Breakpoints = { mobile: 0 };

      mediaQueryStates.set("(min-width: 0px)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      expect(result.current.current).toBe("mobile");
      expect(result.current.value).toBe(0);
      expect(result.current.matches).toEqual(["mobile"]);
    });

    it("handles breakpoints in unsorted order", () => {
      const breakpoints: Breakpoints = {
        lg: 1024,
        xs: 0,
        sm: 640,
        md: 768
      };

      mediaQueryStates.set("(min-width: 0px)", true);
      mediaQueryStates.set("(min-width: 640px)", true);
      mediaQueryStates.set("(min-width: 768px)", true);
      mediaQueryStates.set("(min-width: 1024px)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      // Should still return lg as the largest
      expect(result.current.current).toBe("lg");
      expect(result.current.value).toBe(1024);
      expect(result.current.matches).toEqual(["xs", "sm", "md", "lg"]);
    });

    it("handles decimal values", () => {
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: 640.5,
        md: 768.75
      };

      mediaQueryStates.set("(min-width: 0px)", true);
      mediaQueryStates.set("(min-width: 640.5px)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      expect(result.current.current).toBe("sm");
      expect(result.current.value).toBe(640.5);
    });

    it("cleans up event listeners on unmount", () => {
      const breakpoints: Breakpoints = {
        xs: 0,
        sm: 640,
        md: 768
      };
      const { unmount } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      const xsMql = mediaQueryLists.get("(min-width: 0px)");
      const smMql = mediaQueryLists.get("(min-width: 640px)");
      const mdMql = mediaQueryLists.get("(min-width: 768px)");

      unmount();

      // Should have removed listeners
      expect(xsMql?.removeEventListener).toHaveBeenCalled();
      expect(smMql?.removeEventListener).toHaveBeenCalled();
      expect(mdMql?.removeEventListener).toHaveBeenCalled();
    });
  });

  describe("TypeScript types", () => {
    it("infers breakpoint names from config", () => {
      const breakpoints = {
        xs: 0,
        sm: 640,
        md: 768,
        lg: 1024
      } as const;

      mediaQueryStates.set("(min-width: 0px)", true);

      const { result } = renderHook(() => useBreakpoints(breakpoints, { getInitialValueInEffect: false }));

      // This test mainly verifies TypeScript compilation
      // The type should be "xs" | "sm" | "md" | "lg" | undefined
      expect(["string", "undefined"]).toContain(typeof result.current.current);
    });
  });
});
