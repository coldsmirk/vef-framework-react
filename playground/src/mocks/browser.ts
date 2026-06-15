import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

const worker = setupWorker(...handlers);

/**
 * Start the MSW worker so all subsequent `POST /api` calls are intercepted
 * by the registered mock handlers. Non-/api requests bypass the worker, so
 * Vite HMR, static assets, and SSE remain untouched.
 */
export async function startMockWorker(): Promise<void> {
  await worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: {
      url: "/mockServiceWorker.js"
    }
  });

  console.info("[mocks] MSW worker ready — POST /api is now mocked");
}
