import type { RefObject } from "react";

import { useRef } from "react";

/**
 * Creates a singleton value that persists across renders and is initialized only once.
 * The initializer function is called only on the first render.
 *
 * @param initializer - Function that creates the singleton value.
 * @returns A ref object containing the singleton value.
 * @example
 * ```tsx
 * function Component() {
 *   const emitter = useSingleton(() => new EventEmitter());
 *   const id = useSingleton(() => Math.random());
 *
 *   // emitter.current and id.current are stable across renders
 * }
 * ```
 */
export function useSingleton<T>(initializer: () => T): RefObject<T> {
  const ref = useRef<T | undefined>(undefined);

  if (ref.current === undefined) {
    ref.current = initializer();
  }

  return ref as RefObject<T>;
}
