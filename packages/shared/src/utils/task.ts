/**
 * Schedule a microtask with fallback for older environments.
 */
export function scheduleMicrotask(task: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(task);
  } else {
    // eslint-disable-next-line unicorn/prefer-promise-try -- Promise.try is not available in the older environments this fallback covers.
    Promise.resolve().then(task);
  }
}
