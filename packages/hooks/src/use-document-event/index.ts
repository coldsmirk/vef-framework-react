import { useEffect } from "react";

import { useLatest } from "../use-latest";

/**
 * Attaches an event listener to the document with automatic cleanup.
 * The listener function is always called with the latest version, preventing stale closures.
 *
 * @param type - Event type to listen for (e.g., 'click', 'keydown').
 * @param listener - Event handler function.
 * @param options - Event listener options (capture, passive, once).
 * @example
 * ```tsx
 * function Component() {
 *   useDocumentEvent('keydown', (event) => {
 *     if (event.key === 'Escape') {
 *       closeModal();
 *     }
 *   });
 * }
 * ```
 */
export function useDocumentEvent<TType extends string>(
  type: TType,
  listener: TType extends keyof DocumentEventMap
    ? (this: Document, event: DocumentEventMap[TType]) => void
    : (this: Document, event: CustomEvent) => void,
  options?: boolean | AddEventListenerOptions
): void {
  const listenerRef = useLatest(listener);

  useEffect(() => {
    function handleEvent(event: Event): void {
      listenerRef.current.call(document, event as never);
    }

    document.addEventListener(type, handleEvent, options);

    return () => {
      document.removeEventListener(type, handleEvent, options);
    };
  }, [type, options, listenerRef]);
}
