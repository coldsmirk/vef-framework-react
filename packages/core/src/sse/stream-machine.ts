import { fromPromise, setup } from "xstate";

/**
 * Internal signal: the backend answered 401, so the attempt must stop and
 * the session may retry once after a token refresh. Thrown by the client's
 * `onopen` handler; routed (never surfaced) by the session statechart.
 */
export class TokenExpiredError extends Error {
  constructor() {
    super("Token expired");
    this.name = "TokenExpiredError";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Side-effect surface the stream-session statechart drives. Every dep
 * closes over one `stream()` call's config and handlers.
 */
export interface StreamMachineDeps {
  /**
   * One full connection attempt: prepare headers, open the event source,
   * pump events until the stream ends. In-connection reconnects stay
   * delegated to `fetch-event-source` (it owns `Last-Event-ID` continuity
   * and server-driven retry intervals); a rejection here means the attempt
   * is over — `TokenExpiredError` asks for the refresh path.
   */
  runAttempt: () => Promise<void>;
  /**
   * Ask the host app to refresh the token. Total by contract: resolves
   * `false` instead of rejecting when the refresh fails.
   */
  refreshToken: () => Promise<boolean>;
  /**
   * Deliver the "authentication failed" outcome to the caller's handlers.
   * The session still ends as `completed` — auth failure is reported, not
   * thrown (the caller already got the error through `onError`).
   */
  reportAuthFailure: () => void;
  /**
   * Record the error the `stream()` promise rejects with (the original
   * instance, untouched) once the machine reaches `failed`.
   */
  recordFailure: (error: unknown) => void;
}

/**
 * Session statechart behind `SseClient.stream()`: at most two connection
 * attempts bridged by a single token refresh.
 *
 * ```
 * streaming ──ok/abort──▶ completed
 * │ token expired
 * ▼
 * refreshingToken ──refresh failed──▶ completed (auth failure reported)
 * │ refreshed
 * ▼
 * retrying ──ok/abort──▶ completed
 * │ any error (including a second 401)
 * ▼
 * failed
 * ```
 *
 * The chart replaces the previous recursion (`#executeStream` calling
 * itself) and its scattered closure flags (`tokenRefreshAttempted`,
 * `cleanedUp`): "the refresh has been spent" is now the `retrying` state
 * itself, not a boolean threaded through call frames.
 */
export function createStreamMachine(deps: StreamMachineDeps) {
  return setup({
    actors: {
      runAttempt: fromPromise(() => deps.runAttempt()),
      refreshToken: fromPromise(() => deps.refreshToken())
    },
    actions: {
      recordFailure: (_, params: { error: unknown }) => {
        deps.recordFailure(params.error);
      },
      reportAuthFailure: () => {
        deps.reportAuthFailure();
      }
    },
    guards: {
      wasAborted: (_, params: { error: unknown }) => isAbortError(params.error),
      wasTokenExpired: (_, params: { error: unknown }) => params.error instanceof TokenExpiredError,
      refreshSucceeded: (_, params: { refreshed: boolean }) => params.refreshed
    }
  }).createMachine({
    id: "sseStream",
    initial: "streaming",
    states: {
      streaming: {
        invoke: {
          src: "runAttempt",
          onDone: { target: "completed" },
          onError: [
            {
              guard: { type: "wasAborted", params: ({ event }) => { return { error: event.error }; } },
              target: "completed"
            },
            {
              guard: { type: "wasTokenExpired", params: ({ event }) => { return { error: event.error }; } },
              target: "refreshingToken"
            },
            {
              target: "failed",
              actions: { type: "recordFailure", params: ({ event }) => { return { error: event.error }; } }
            }
          ]
        }
      },
      refreshingToken: {
        invoke: {
          src: "refreshToken",
          onDone: [
            {
              guard: { type: "refreshSucceeded", params: ({ event }) => { return { refreshed: event.output }; } },
              target: "retrying"
            },
            {
              target: "completed",
              actions: "reportAuthFailure"
            }
          ],
          onError: {
            target: "completed",
            actions: "reportAuthFailure"
          }
        }
      },
      retrying: {
        invoke: {
          src: "runAttempt",
          onDone: { target: "completed" },
          onError: [
            {
              guard: { type: "wasAborted", params: ({ event }) => { return { error: event.error }; } },
              target: "completed"
            },
            {
              target: "failed",
              actions: { type: "recordFailure", params: ({ event }) => { return { error: event.error }; } }
            }
          ]
        }
      },
      completed: { type: "final" },
      failed: { type: "final" }
    }
  });
}
