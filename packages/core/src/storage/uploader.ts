import type { AxiosProgressEvent } from "axios";
import type { Actor } from "xstate";

import type { HttpClient } from "../http";
import type { InitUploadResponse, ProtocolContext } from "./protocol";
import type { ResumePlan } from "./resumable/plan";
import type { UploaderOptions, UploadProgress, UploadResult, UploadStatus } from "./types";

import { createActor } from "xstate";

import { UploadAbortedError, UploadError, UploadPartError, UploadProtocolError } from "./errors";
import { abortUpload, completeUpload, DEFAULT_API_PATH, DEFAULT_RESOURCE, DEFAULT_VERSION, initUpload, uploadPart } from "./protocol";
import { createUploaderMachine } from "./uploader-machine";

const DEFAULT_PART_CONCURRENCY = 3;
const DEFAULT_MAX_PART_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY = 500;
const DEFAULT_RETRY_MAX_DELAY = 8000;

/**
 * Computes the byte size of the part at `partNumber` (1-indexed) given the
 * declared total size and the backend's authoritative `partSize`. Every part
 * except the last is exactly `partSize`; the last one carries the remainder.
 */
function computePartSize(total: number, partSize: number, partNumber: number, partCount: number): number {
  if (partNumber < partCount) {
    return partSize;
  }

  return total - partSize * (partCount - 1);
}

/**
 * Pause helper used between part retries. Rejects early when the supplied
 * signal aborts so a pending backoff does not delay teardown.
 */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new UploadAbortedError());
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new UploadAbortedError());
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Drives a single file through the four-step chunked upload protocol
 * (`init_upload → upload_part* → complete_upload`) exposed by the framework's
 * `sys/storage` resource. A caller abort triggers a best-effort
 * `abort_upload`; non-abort failures leave the session intact so the upload
 * can resume.
 *
 * The lifecycle is governed by the statechart in `./uploader-machine.ts`:
 * this class supplies the phase runners (session prep, worker pool,
 * completion, backend abort) and bridges actor snapshots onto the public
 * `status` / `onStatusChange` / `start()`-promise surface.
 *
 * The instance is one-shot: a successful or failed run cannot be restarted.
 * Create a fresh `Uploader` for each file.
 */
export class Uploader {
  readonly #ctx: ProtocolContext;
  readonly #file: Blob;
  readonly #filename: string;
  readonly #contentType: string | undefined;
  readonly #isPublic: boolean | undefined;
  readonly #partConcurrency: number;
  readonly #maxPartRetries: number;
  readonly #retryBaseDelay: number;
  readonly #retryMaxDelay: number;
  readonly #onProgress?: (progress: UploadProgress) => void;
  readonly #onStatusChange?: (status: UploadStatus) => void;
  readonly #onSessionOpened?: UploaderOptions["onSessionOpened"];

  readonly #controller: AbortController;
  /**
   * Detaches the external-signal forwarder when set up.
   */
  readonly #detachExternalSignal: (() => void) | undefined;

  readonly #actor: Actor<ReturnType<typeof createUploaderMachine>>;

  /**
   * Mirror of the actor's state value, kept so the `status` getter and the
   * change-deduplication for `onStatusChange` stay synchronous.
   */
  #lastStatus: UploadStatus = "idle";
  #progress: UploadProgress;
  #startPromise: Promise<UploadResult> | undefined;
  #settle: { resolve: (result: UploadResult) => void; reject: (error: UploadError) => void } | undefined;

  /**
   * Session returned by `init_upload` (or synthesised from a resume plan).
   */
  #session: InitUploadResponse | undefined;
  /**
   * Error recorded by the statechart's `recordFailure` action; `start()`
   * rejects with its normalized form when the machine reaches `failed`.
   */
  #failure: unknown;
  /**
   * Result captured by the completing phase, resolved out of `start()`.
   */
  #result: UploadResult | undefined;

  /**
   * Bytes accepted by parts that have finished uploading.
   */
  #completedBytes = 0;
  /**
   * Latest in-flight `loaded` value per part number.
   */
  readonly #inFlightLoaded = new Map<number, number>();
  /**
   * Next 1-indexed part number that workers will claim.
   */
  #nextPart = 1;
  /**
   * Part numbers the workers should skip — populated by `start(plan)`
   * for the resume path so already-uploaded parts are not re-sent.
   */
  #skipParts: ReadonlySet<number> = new Set();

  constructor(http: Readonly<HttpClient>, file: Blob, options: UploaderOptions = {}) {
    const filename = options.init?.filename ?? (file instanceof File ? file.name : "");

    if (!filename) {
      throw new UploadError("Uploader requires a filename (set options.init.filename for Blob input)");
    }

    this.#ctx = {
      http,
      apiPath: options.apiPath ?? DEFAULT_API_PATH,
      resource: options.resource ?? DEFAULT_RESOURCE,
      version: options.version ?? DEFAULT_VERSION
    };
    this.#file = file;
    this.#filename = filename;
    this.#contentType = options.init?.contentType ?? (file instanceof File ? file.type || undefined : undefined);
    this.#isPublic = options.init?.public;
    this.#partConcurrency = Math.max(1, options.partConcurrency ?? DEFAULT_PART_CONCURRENCY);
    this.#maxPartRetries = Math.max(1, options.maxPartRetries ?? DEFAULT_MAX_PART_RETRIES);
    this.#retryBaseDelay = Math.max(0, options.retryBaseDelay ?? DEFAULT_RETRY_BASE_DELAY);
    this.#retryMaxDelay = Math.max(this.#retryBaseDelay, options.retryMaxDelay ?? DEFAULT_RETRY_MAX_DELAY);
    this.#onProgress = options.onProgress;
    this.#onStatusChange = options.onStatusChange;
    this.#onSessionOpened = options.onSessionOpened;

    this.#controller = new AbortController();
    this.#detachExternalSignal = this.#linkExternalSignal(options.signal);

    this.#progress = {
      loaded: 0,
      total: file.size,
      partsCompleted: 0,
      partsTotal: 0,
      percent: 0
    };

    this.#actor = createActor(createUploaderMachine({
      prepareSession: plan => this.#openSession(plan),
      uploadParts: () => this.#uploadAllParts(this.#requireSession()),
      completeSession: () => this.#completeSession(),
      abortSession: () => this.#abortSession(),
      killTransport: () => {
        this.#controller.abort();
      },
      recordFailure: error => {
        this.#failure = error;
      },
      abortRequested: () => this.#controller.signal.aborted
    }));

    this.#actor.subscribe(snapshot => {
      this.#applyStatus(snapshot.value);

      if (snapshot.status === "done") {
        this.#finishRun(snapshot.value);
      }
    });
    this.#actor.start();
  }

  /**
   * Current lifecycle status.
   */
  public get status(): UploadStatus {
    return this.#lastStatus;
  }

  /**
   * Latest aggregated progress snapshot.
   */
  public get progress(): UploadProgress {
    return this.#progress;
  }

  /**
   * Start the upload. Returns the eventual `UploadResult` on success or
   * rejects with an `UploadError` (use `instanceof UploadAbortedError` /
   * `UploadProtocolError` / `UploadPartError` to discriminate). Calling
   * `start()` more than once returns the original promise.
   *
   * When called with a `plan` of kind `"resume"`, the uploader skips
   * `init_upload` and synthesises the session from the plan's
   * `claimId`/`partSize`/`partCount`. Workers will skip every part
   * number in `plan.completedParts`. The default behaviour
   * (no plan, or `kind: "fresh"`) is unchanged.
   */
  public start(plan?: ResumePlan): Promise<UploadResult> {
    if (this.#startPromise) {
      return this.#startPromise;
    }

    this.#startPromise = new Promise<UploadResult>((resolve, reject) => {
      this.#settle = {
        resolve,
        reject
      };
    });

    this.#actor.send({ type: "START", plan: plan ?? { kind: "fresh" } });

    return this.#startPromise;
  }

  /**
   * Cancel an in-flight upload and best-effort abort the backend session.
   * Safe to call from any state — terminal states are a no-op. Returns when
   * the backend has been notified (or never reachable in the first place).
   */
  public async abort(): Promise<void> {
    if (this.#actor.getSnapshot().status === "done") {
      return;
    }

    this.#requestAbort();

    const pending = this.#startPromise;

    if (pending) {
      try {
        await pending;
      } catch {
        // Swallowed: the rejection is the caller's await on start().
      }
    }
  }

  /**
   * Route a cancellation into the statechart AND trip the transport
   * controller. The event settles the lifecycle when a run is active; the
   * controller latch covers the not-yet-started case (the machine drops
   * `ABORT` while idle, and `start()` then routes through the
   * `abortRequested` guard).
   */
  #requestAbort(): void {
    this.#actor.send({ type: "ABORT" });
    this.#controller.abort();
  }

  /**
   * Forward an external `AbortSignal` into the cancellation path.
   * Returns a detacher so the listener can be removed on teardown.
   */
  #linkExternalSignal(signal: AbortSignal | undefined): (() => void) | undefined {
    if (!signal) {
      return undefined;
    }

    if (signal.aborted) {
      // The actor does not exist yet during construction — latching the
      // controller is enough, the `abortRequested` guard picks it up.
      this.#controller.abort();
      return undefined;
    }

    const onAbort = (): void => this.#requestAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    return () => signal.removeEventListener("abort", onAbort);
  }

  #applyStatus(status: UploadStatus): void {
    if (this.#lastStatus === status) {
      return;
    }

    this.#lastStatus = status;
    this.#onStatusChange?.(status);
  }

  /**
   * Settle the `start()` promise once the statechart reaches a final state.
   */
  #finishRun(terminal: UploadStatus): void {
    this.#detachExternalSignal?.();

    const settle = this.#settle;

    if (!settle) {
      return;
    }

    switch (terminal) {
      case "succeeded": {
        settle.resolve(this.#requireResult());
        return;
      }

      case "aborted": {
        settle.reject(new UploadAbortedError());
        return;
      }

      default: {
        settle.reject(this.#normalizeError(this.#failure));
      }
    }
  }

  #requireSession(): InitUploadResponse {
    if (!this.#session) {
      throw new UploadError("upload session is not open");
    }

    return this.#session;
  }

  #requireResult(): UploadResult {
    if (!this.#result) {
      throw new UploadError("upload result missing after completion");
    }

    return this.#result;
  }

  #emitProgress(): void {
    let inFlight = 0;

    for (const loaded of this.#inFlightLoaded.values()) {
      inFlight += loaded;
    }

    const loaded = Math.min(this.#progress.total, this.#completedBytes + inFlight);
    const percent = this.#progress.total === 0 ? 0 : Math.floor((loaded / this.#progress.total) * 100);

    this.#progress = {
      ...this.#progress,
      loaded,
      percent
    };
    this.#onProgress?.(this.#progress);
  }

  /**
   * Initializing phase: resolve (or open) the multipart session, then apply
   * every session side effect — resume bookkeeping, `onSessionOpened`, and
   * the seeded progress emission — before resolving, so the `uploading`
   * status only becomes visible after consumers saw the session snapshot.
   *
   * Fresh: call `init_upload`, no parts to skip.
   * Resume: synthesise the session from the persisted record, validate
   * the file size against `partSize × partCount` (a mismatch means the
   * file changed between sessions; we refuse rather than risk assembling
   * inconsistent bytes), and seed `#skipParts` / `#completedBytes` from
   * the authoritative `list_parts` sizes (NOT from the local file —
   * tail-part size could differ if the file's last byte was rewritten
   * after the prior session).
   */
  async #openSession(plan: ResumePlan): Promise<void> {
    const {
      session,
      skipParts,
      completedBytes
    } = await this.#prepareSession(plan);

    this.#session = session;
    this.#skipParts = skipParts;
    this.#completedBytes = completedBytes;

    this.#onSessionOpened?.({
      claimId: session.claimId,
      key: session.key,
      partSize: session.partSize,
      partCount: session.partCount,
      expiresAt: session.expiresAt
    });

    this.#progress = {
      ...this.#progress,
      partsTotal: session.partCount,
      partsCompleted: skipParts.size
    };
    this.#emitProgress();
  }

  async #prepareSession(plan: ResumePlan): Promise<{
    session: InitUploadResponse;
    skipParts: ReadonlySet<number>;
    completedBytes: number;
  }> {
    if (plan.kind === "fresh") {
      const session = await initUpload(
        this.#ctx,
        {
          filename: this.#filename,
          size: this.#file.size,
          contentType: this.#contentType,
          public: this.#isPublic
        },
        this.#controller.signal
      );

      return {
        session,
        skipParts: new Set(),
        completedBytes: 0
      };
    }

    const declaredSize = plan.partSize * plan.partCount;
    const minSize = plan.partSize * (plan.partCount - 1) + 1;

    if (this.#file.size < minSize || this.#file.size > declaredSize) {
      throw new UploadProtocolError(
        "resume",
        `file size ${this.#file.size} does not fit the resumed session (partSize=${plan.partSize}, partCount=${plan.partCount})`
      );
    }

    const skipParts = new Set<number>();
    let completedBytes = 0;

    for (const part of plan.completedParts) {
      skipParts.add(part.partNumber);
      completedBytes += part.size;
    }

    const session: InitUploadResponse = {
      key: plan.key,
      claimId: plan.claimId,
      originalFilename: this.#filename,
      partSize: plan.partSize,
      partCount: plan.partCount,
      expiresAt: plan.expiresAt
    };

    return {
      session,
      skipParts,
      completedBytes
    };
  }

  /**
   * Completing phase: finalize the session and capture the result that
   * `start()` resolves with.
   */
  async #completeSession(): Promise<void> {
    const session = this.#requireSession();
    const info = await completeUpload(this.#ctx, session.claimId, this.#controller.signal);

    this.#result = {
      bucket: info.bucket,
      key: info.key,
      eTag: info.eTag,
      size: info.size,
      contentType: info.contentType,
      lastModified: info.lastModified,
      originalFilename: info.originalFilename,
      metadata: info.metadata
    };
  }

  /**
   * Aborting phase: best-effort backend teardown. Only caller-initiated
   * aborts reach this — a non-abort failure never destroys the claim, so a
   * persisted record can still resume against it.
   */
  async #abortSession(): Promise<void> {
    const claimId = this.#session?.claimId;

    if (claimId !== undefined) {
      await abortUpload(this.#ctx, claimId);
    }
  }

  /**
   * Maintain a `partConcurrency`-sized pool of workers each pulling the
   * next part from `#nextPart`. The first error rejects the surrounding
   * `Promise.all` and triggers abort via the shared controller; the
   * remaining workers exit on the next signal check.
   */
  async #uploadAllParts(session: InitUploadResponse): Promise<void> {
    const concurrency = Math.min(this.#partConcurrency, session.partCount);
    const workers: Array<Promise<void>> = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push(this.#worker(session));
    }

    try {
      await Promise.all(workers);
    } catch (error) {
      // Surface the first worker failure but cancel any siblings still
      // racing toward completion. Tripping the controller here is pure
      // transport teardown — the statechart still routes this rejection
      // to `failed` (session kept alive for resume), because abort-vs-
      // failure is decided by event channel, not by signal state.
      this.#controller.abort();
      throw error;
    }
  }

  async #worker(session: InitUploadResponse): Promise<void> {
    while (!this.#controller.signal.aborted) {
      const partNumber = this.#claimNextPart(session.partCount);

      if (partNumber === null) {
        return;
      }

      await this.#uploadPartWithRetry(session, partNumber);
    }
  }

  #claimNextPart(partCount: number): number | null {
    while (this.#nextPart <= partCount) {
      const candidate = this.#nextPart++;

      if (!this.#skipParts.has(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  async #uploadPartWithRetry(session: InitUploadResponse, partNumber: number): Promise<void> {
    const partSize = computePartSize(this.#file.size, session.partSize, partNumber, session.partCount);
    const start = (partNumber - 1) * session.partSize;
    const blob = this.#file.slice(start, start + partSize);

    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.#maxPartRetries) {
      attempt++;

      if (this.#controller.signal.aborted) {
        throw new UploadAbortedError();
      }

      try {
        this.#inFlightLoaded.set(partNumber, 0);

        await uploadPart(this.#ctx, {
          claimId: session.claimId,
          partNumber,
          blob,
          onProgress: (event: AxiosProgressEvent) => {
            this.#inFlightLoaded.set(partNumber, Math.min(partSize, event.loaded));
            this.#emitProgress();
          },
          signal: this.#controller.signal
        });

        this.#inFlightLoaded.delete(partNumber);
        this.#completedBytes += partSize;
        this.#progress = {
          ...this.#progress,
          partsCompleted: this.#progress.partsCompleted + 1
        };
        this.#emitProgress();
        return;
      } catch (error) {
        this.#inFlightLoaded.delete(partNumber);
        lastError = error;

        if (this.#controller.signal.aborted) {
          throw new UploadAbortedError();
        }

        if (attempt >= this.#maxPartRetries) {
          break;
        }

        const wait = Math.min(this.#retryMaxDelay, this.#retryBaseDelay * 2 ** (attempt - 1));
        await delay(wait, this.#controller.signal);
      }
    }

    throw new UploadPartError(partNumber, attempt, { cause: lastError });
  }

  /**
   * Map raw axios / unknown errors to the storage error hierarchy so callers
   * only need to know about `UploadError` subclasses. Already-typed upload
   * errors are returned unchanged.
   */
  #normalizeError(error: unknown): UploadError {
    if (error instanceof UploadError) {
      return error;
    }

    if (error instanceof Error) {
      return new UploadProtocolError("unknown", error.message, { cause: error });
    }

    return new UploadProtocolError("unknown", String(error));
  }
}

/**
 * Convenience wrapper that constructs an Uploader and immediately starts it.
 * Use the class directly when you need to expose `abort()` to the UI or
 * observe status transitions externally.
 */
export function uploadFile(http: Readonly<HttpClient>, file: Blob, options?: UploaderOptions): Promise<UploadResult> {
  const uploader = new Uploader(http, file, options);
  return uploader.start();
}
