/**
 * Schedule a microtask with fallback for older environments.
 */
export function scheduleMicrotask(task: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(task);
  } else {
    Promise.resolve().then(task);
  }
}
