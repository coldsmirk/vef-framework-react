import type { Dispatch, SetStateAction } from "react";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State hook that batches updates using requestAnimationFrame.
 * Useful for high-frequency updates (e.g., scroll, resize, mouse move) to prevent excessive re-renders.
 *
 * @param initialState - Initial state value or lazy initializer function.
 * @returns Tuple of [state, setState] similar to useState.
 * @example
 * ```tsx
 * function Component() {
 *   const [position, setPosition] = useRafState({ x: 0, y: 0 });
 *
 *   useEffect(() => {
 *     const handleMove = (e: MouseEvent) => {
 *       setPosition({ x: e.clientX, y: e.clientY });
 *     };
 *     window.addEventListener('mousemove', handleMove);
 *     return () => window.removeEventListener('mousemove', handleMove);
 *   }, []);
 * }
 * ```
 */
export function useRafState<T>(initialState: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const frameIdRef = useRef(0);
  const [state, setState] = useState(initialState);

  const setRafState = useCallback((value: SetStateAction<T>) => {
    cancelAnimationFrame(frameIdRef.current);
    frameIdRef.current = requestAnimationFrame(() => {
      setState(value);
    });
  }, []);

  useEffect(() => () => {
    cancelAnimationFrame(frameIdRef.current);
  }, []);

  return [state, setRafState];
}
