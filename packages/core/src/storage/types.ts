/**
 * Object key namespace prefixes used by the framework. Mirrors the constants
 * declared on the Go side; clients embed them in object keys to communicate
 * the intended visibility.
 *
 * - `PUBLIC_PREFIX`: anonymous-readable via the backend's direct URL.
 * - `PRIVATE_PREFIX`: authenticated reads through `/storage/files/<key>`.
 */
export const PUBLIC_PREFIX = "pub/";
export const PRIVATE_PREFIX = "priv/";

/**
 * The lifecycle status of an Uploader instance. Transitions are linear up to
 * a terminal state (`succeeded`, `failed`, `aborted`).
 *
 * - `idle`: created but `start()` has not been called yet.
 * - `initializing`: opening the multipart session against the backend.
 * - `uploading`: streaming parts to the backend.
 * - `completing`: assembling the multipart session on the backend.
 * - `aborting`: caller requested cancellation and cleanup is in flight.
 * - `succeeded`: terminal — final ObjectInfo is available on the result.
 * - `failed`: terminal — the original error is stored on the instance.
 * - `aborted`: terminal — `abort()` (or the external signal) completed.
 */
export type UploadStatus
  = | "idle"
    | "initializing"
    | "uploading"
    | "completing"
    | "aborting"
    | "succeeded"
    | "failed"
    | "aborted";

/**
 * Initialization parameters forwarded to the backend's `init_upload`. Either
 * supply these explicitly via `UploaderOptions.init` or rely on the defaults
 * derived from the `File`'s `name`, `type`, and `size`.
 */
export interface UploadInit {
  /**
   * Override the original filename. Defaults to `file.name`.
   */
  filename?: string;
  /**
   * Override the declared MIME type. Defaults to `file.type`.
   */
  contentType?: string;
  /**
   * Land the object under `pub/` (`true`) or `priv/` (`false`/omitted).
   */
  public?: boolean;
}

/**
 * Aggregated upload progress emitted by the Uploader.
 *
 * `loaded` aggregates bytes acknowledged across **completed** parts, plus the
 * latest in-flight progress for each part that has not yet finished. The
 * value is monotonically non-decreasing within a single upload session.
 */
export interface UploadProgress {
  /**
   * Bytes acknowledged so far. Never exceeds `total`.
   */
  loaded: number;
  /**
   * Total file size in bytes (mirrors the declared `size`).
   */
  total: number;
  /**
   * Number of parts that have been fully accepted by the backend.
   */
  partsCompleted: number;
  /**
   * Total number of parts in the upload plan.
   */
  partsTotal: number;
  /**
   * Convenience field: `loaded / total` rounded to an integer percentage.
   */
  percent: number;
}

/**
 * The final result of a successful upload. Combines the backend `ObjectInfo`
 * with the framework-tracked `originalFilename`.
 */
export interface UploadResult {
  bucket: string;
  key: string;
  eTag: string;
  size: number;
  contentType: string;
  lastModified: string;
  originalFilename: string;
  metadata?: Record<string, string>;
}

/**
 * Construction options for `Uploader`. Defaults match the server's documented
 * conventions; override only when you have a concrete reason.
 */
export interface UploaderOptions {
  /**
   * RPC entrypoint URL. Defaults to `/api`.
   */
  apiPath?: string;
  /**
   * RPC resource name. Defaults to `sys/storage`.
   */
  resource?: string;
  /**
   * RPC version. Defaults to `v1`.
   */
  version?: string;
  /**
   * Init-time overrides for the backend session.
   */
  init?: UploadInit;
  /**
   * Maximum number of parts uploaded in parallel. The backend can already
   * absorb high concurrency; the practical cap is the client's outbound
   * bandwidth and the browser's per-origin connection budget. Defaults to 3.
   */
  partConcurrency?: number;
  /**
   * Per-part retry budget for transient failures. The initial attempt counts
   * as 1, so a value of 3 yields up to 2 retries before the part is treated
   * as fatal. Defaults to 3.
   */
  maxPartRetries?: number;
  /**
   * Base delay (ms) for exponential per-part retry backoff. Defaults to 500.
   */
  retryBaseDelay?: number;
  /**
   * Maximum delay (ms) any single retry will wait. Defaults to 8000.
   */
  retryMaxDelay?: number;
  /**
   * External abort signal. Combined with the internal controller so any of
   * `signal.abort()`, `uploader.abort()`, or a fatal protocol error will
   * tear down in-flight parts and trigger a best-effort `abort_upload`.
   */
  signal?: AbortSignal;
  /**
   * Invoked after every part progress tick.
   */
  onProgress?: (progress: UploadProgress) => void;
  /**
   * Invoked on every `UploadStatus` transition.
   */
  onStatusChange?: (status: UploadStatus) => void;
  /**
   * Invoked once after the backend has confirmed an upload session.
   * Carries the fields needed to persist a resumable record. Fires on
   * the fresh path (after `init_upload` returns) and on the resume path
   * (synthesized immediately from the supplied `ResumePlan`) so a
   * consumer like `useUpload` can write the localStorage record at the
   * earliest opportunity in either case.
   */
  onSessionOpened?: (session: UploadSessionSnapshot) => void;
}

/**
 * Minimal session description handed to `onSessionOpened`. Mirrors the
 * subset of `InitUploadResponse` that downstream resume-persistence
 * code cares about. The Uploader carries the original `expiresAt`
 * through both the fresh path (returned by `init_upload`) and the
 * resume path (sourced from the persisted record) so consumers can
 * always parse it directly.
 */
export interface UploadSessionSnapshot {
  claimId: string;
  key: string;
  partSize: number;
  partCount: number;
  expiresAt: string;
}
