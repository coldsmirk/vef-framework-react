/**
 * Base class for every error surfaced by the storage upload pipeline.
 * Tests and callers should use `instanceof UploadError` to discriminate
 * uploader failures from unrelated runtime errors.
 */
export class UploadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UploadError";
  }
}

/**
 * Thrown when the caller (or external signal) cancels an in-flight upload.
 * Surfaces from the `start()` promise so callers can distinguish a manual
 * cancellation from a genuine protocol failure.
 */
export class UploadAbortedError extends UploadError {
  constructor(message = "Upload aborted") {
    super(message);
    this.name = "UploadAbortedError";
  }
}

/**
 * Thrown when the backend rejects a protocol RPC (init_upload,
 * complete_upload, abort_upload) in a way that is not recoverable through
 * the upload's own retry mechanism.
 *
 * `cause` preserves the underlying axios / `BusinessError` for caller
 * diagnostics; do not parse `cause` for control flow.
 */
export class UploadProtocolError extends UploadError {
  /**
   * The protocol action that produced the error.
   */
  readonly action: string;

  constructor(action: string, message: string, options?: ErrorOptions) {
    super(`[${action}] ${message}`, options);
    this.name = "UploadProtocolError";
    this.action = action;
  }
}

/**
 * Thrown when a single part fails repeatedly past `maxPartRetries`. Carries
 * the part number so the caller can surface a specific failure to the user.
 */
export class UploadPartError extends UploadError {
  /**
   * The 1-indexed part number that failed.
   */
  readonly partNumber: number;
  /**
   * The number of attempts made before giving up.
   */
  readonly attempts: number;

  constructor(partNumber: number, attempts: number, options?: ErrorOptions) {
    super(`Upload part ${partNumber} failed after ${attempts} attempt(s)`, options);
    this.name = "UploadPartError";
    this.partNumber = partNumber;
    this.attempts = attempts;
  }
}
