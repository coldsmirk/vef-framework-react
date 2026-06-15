import type { MutableRefObject } from "react";

import { useRef } from "react";

/**
 * Returns a ref that always contains the latest value.
 * Useful for accessing current props/state in callbacks without re-creating them.
 *
 * @param value - The value to track.
 * @returns A ref object containing the latest value.
 * @example
 * ```tsx
 * function Component({ onChange }) {
 *   const onChangeRef = useLatest(onChange);
 *
 *   useEffect(() => {
 *     const handler = () => onChangeRef.current();
 *     window.addEventListener('resize', handler);
 *     return () => window.removeEventListener('resize', handler);
 *   }, []); // No need to include onChange in deps
 * }
 * ```
 */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);

  ref.current = value;

  return ref;
}
