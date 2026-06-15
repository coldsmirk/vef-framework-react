import { isUndefined } from "@vef-framework-react/shared";
import { useEffect } from "react";

import { useWindowEvent } from "../lib";
import { useRafState } from "../use-raf-state";

const eventListenerOptions = {
  passive: true
};

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Tracks the current viewport dimensions (window.innerWidth/innerHeight).
 * Automatically updates on window resize and orientation change events.
 * Uses requestAnimationFrame to batch updates and prevent excessive re-renders.
 *
 * @returns Current viewport size object with width and height.
 * @example
 * ```tsx
 * function Component() {
 *   const { width, height } = useViewportSize();
 *
 *   return <div>Viewport: {width}x{height}</div>;
 * }
 * ```
 */
export function useViewportSize(): ViewportSize {
  const isWindowDefined = !isUndefined(globalThis.window);
  const [viewportSize, setViewportSize] = useRafState<ViewportSize>(() => {
    return {
      width: isWindowDefined ? window.innerWidth : 0,
      height: isWindowDefined ? window.innerHeight : 0
    };
  });

  useEffect(() => {
    function updateSize(): void {
      if (!isUndefined(globalThis.window)) {
        setViewportSize({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }
    }

    updateSize();
  }, [setViewportSize]);

  useWindowEvent("resize", () => {
    if (!isUndefined(globalThis.window)) {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }
  }, eventListenerOptions);

  useWindowEvent("orientationchange", () => {
    if (!isUndefined(globalThis.window)) {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }
  }, eventListenerOptions);

  return viewportSize;
}
