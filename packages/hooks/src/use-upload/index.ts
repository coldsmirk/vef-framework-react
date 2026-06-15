import type {
  FileFingerprinter,
  ResumablePersistence,
  ResumeDecisionHandler,
  UploaderOptions,
  UploadError,
  UploadInit,
  UploadProgress,
  UploadResult,
  UploadStatus
} from "@vef-framework-react/core";

import {
  HTTP_CLIENT,
  LocalStoragePersistence,
  PrefixFingerprinter,
  resolveResumePlan,
  STORAGE_API_PATH,
  STORAGE_RESOURCE,
  STORAGE_VERSION,
  UploadAbortedError,
  Uploader,
  useApiClient,
  WeakFingerprinter
} from "@vef-framework-react/core";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { useLatest } from "../use-latest";

/**
 * Lifecycle states a caller would consider "still working".
 */
const ACTIVE_STATUSES = new Set<UploadStatus>(["initializing", "uploading", "completing", "aborting"]);

/**
 * Pick the strongest fingerprinter the runtime supports. `PrefixFingerprinter`
 * needs `crypto.subtle` (HTTPS / localhost in browsers); when unavailable
 * fall back to the metadata-only `WeakFingerprinter`. The fallback is
 * documented as "weaker" because identical name+size+mtime over different
 * content will collide, but it is strictly better than disabling resume.
 */
function defaultFingerprinter(): FileFingerprinter {
  if (typeof crypto !== "undefined" && crypto.subtle !== undefined) {
    return new PrefixFingerprinter();
  }

  return new WeakFingerprinter();
}

/**
 * Configuration accepted by `useUpload`. Mirrors the headless
 * `UploaderOptions` minus the fields that React owns (`signal` is managed
 * internally, `onProgress` / `onStatusChange` are forwarded). Adds the
 * familiar `onSuccess` / `onError` lifecycle callbacks consumers expect.
 */
export interface UseUploadOptions extends Omit<UploaderOptions, "signal" | "onProgress" | "onStatusChange" | "onSessionOpened"> {
  /**
   * Fires on every aggregated progress tick.
   */
  onProgress?: (progress: UploadProgress) => void;
  /**
   * Fires on every Uploader status transition.
   */
  onStatusChange?: (status: UploadStatus) => void;
  /**
   * Fires once when the upload completes successfully.
   */
  onSuccess?: (result: UploadResult) => void;
  /**
   * Fires once on any terminal failure (including aborts).
   */
  onError?: (error: UploadError) => void;
  /**
   * Persistence layer for resumable-upload records. When omitted, a
   * `LocalStoragePersistence` is used. Pass a custom implementation to
   * route records into IndexedDB, a tenant-namespaced backend, or a
   * server-side session store. Pass `null` to disable resume entirely.
   */
  persistence?: ResumablePersistence | null;
  /**
   * Fingerprinting strategy used to identify a file across sessions.
   * Defaults to `PrefixFingerprinter` (SHA-256 of name + size +
   * lastModified + first 4 MiB) when `crypto.subtle` is available, with
   * `WeakFingerprinter` (name + size + lastModified only) as the
   * fallback. Override to plug in a different policy (e.g. full-file
   * SHA-256 inside a Web Worker).
   */
  fingerprinter?: FileFingerprinter;
  /**
   * Decision handler invoked when a resume candidate is found. Receives
   * the persisted record and the live `list_parts` result so the UI can
   * present a meaningful confirmation. The default — when omitted — is
   * `"discard"`: resuming the wrong file is worse than re-uploading.
   */
  onResumeDetected?: ResumeDecisionHandler;
}

/**
 * Reactive snapshot the hook exposes to its caller. The `error` and
 * `result` fields are mutually exclusive: at most one is non-null in any
 * terminal state.
 */
export interface UseUploadResult {
  /**
   * Start a new upload. Cancels any upload still in flight.
   */
  upload: (file: File | Blob, init?: UploadInit) => Promise<UploadResult>;
  /**
   * Cancel the in-flight upload, if any. No-op when idle / terminal.
   */
  abort: () => void;
  /**
   * Clear state and detach the current Uploader.
   */
  reset: () => void;
  /**
   * Current Uploader status. `"idle"` between resets.
   */
  status: UploadStatus;
  /**
   * Latest aggregated progress; zeroed between resets.
   */
  progress: UploadProgress;
  /**
   * Terminal error, when status is `"failed"`.
   */
  error: UploadError | null;
  /**
   * Terminal result, when status is `"succeeded"`.
   */
  result: UploadResult | null;
  /**
   * Convenience: status is one of initializing/uploading/completing/aborting.
   */
  isUploading: boolean;
}

interface InternalState {
  status: UploadStatus;
  progress: UploadProgress;
  error: UploadError | null;
  result: UploadResult | null;
}

function initialState(): InternalState {
  return {
    status: "idle",
    progress: {
      loaded: 0,
      total: 0,
      partsCompleted: 0,
      partsTotal: 0,
      percent: 0
    },
    error: null,
    result: null
  };
}

/**
 * Drive a single chunked upload through `vef-framework-go`'s `sys/storage`
 * RPC. Returns a snapshot of upload state plus imperative `upload` / `abort`
 * / `reset` handles. One in-flight upload at a time; calling `upload` again
 * cancels the previous run.
 *
 * For batch uploads (multiple files in parallel) reach for the headless
 * `Uploader` class from `@vef-framework-react/core` directly — this hook is
 * a thin React adapter intentionally scoped to a single upload per consumer.
 */
export function useUpload(options: UseUploadOptions = {}): UseUploadResult {
  const apiClient = useApiClient();
  const http = apiClient[HTTP_CLIENT];

  const optionsRef = useLatest(options);
  const stateRef = useRef<InternalState>(initialState());
  const listenersRef = useRef(new Set<() => void>());
  const uploaderRef = useRef<Uploader | null>(null);
  /**
   * Monotonic upload-attempt counter. Every `upload()` call captures the
   * generation it owns; awaited work checks `genRef.current !== gen` to
   * detect being replaced by a newer call (re-entrancy) and bails out
   * before mutating state, persistence, or the Uploader pool.
   */
  const genRef = useRef(0);
  /**
   * Controller for the pre-Uploader phase (fingerprint + resolveResumePlan).
   * `abort()` / `reset()` / a fresh `upload()` call cancel it to unblock
   * any in-flight `list_parts` request that would otherwise pin the
   * caller until the network settles.
   */
  const prelaunchControllerRef = useRef<AbortController | null>(null);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);

    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback((): InternalState => stateRef.current, []);

  const notify = useCallback((patch: Partial<InternalState>) => {
    stateRef.current = { ...stateRef.current, ...patch };

    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  const upload = useCallback(
    async (file: File | Blob, init?: UploadInit): Promise<UploadResult> => {
      const opts = optionsRef.current;

      // Take ownership of this attempt up front. Anything that awaits
      // below has to re-check `gen` before mutating shared state —
      // otherwise a fast follow-up upload() would race with our
      // post-await work (writing persistence records, swapping
      // uploaderRef, etc.).
      const gen = ++genRef.current;
      const isStale = (): boolean => genRef.current !== gen;

      // Cancel any in-flight pre-launch work (list_parts from a prior
      // upload() that has not yet started its Uploader). Without this
      // a slow list_parts response from the previous call would block
      // forever even after we superseded it.
      prelaunchControllerRef.current?.abort();
      const controller = new AbortController();
      prelaunchControllerRef.current = controller;

      // Resume support requires File metadata (name/size/lastModified)
      // for fingerprinting. Blob inputs (no File semantics) bypass the
      // resume planner entirely and always run a fresh upload.
      const resumable = file instanceof File && opts.persistence !== null;
      const persistence = resumable ? (opts.persistence ?? new LocalStoragePersistence()) : null;
      const fingerprinter = resumable ? (opts.fingerprinter ?? defaultFingerprinter()) : null;

      const ctx = {
        http,
        apiPath: opts.apiPath ?? STORAGE_API_PATH,
        resource: opts.resource ?? STORAGE_RESOURCE,
        version: opts.version ?? STORAGE_VERSION
      };

      // Compute the fingerprint once up front and thread the string
      // through both the planner and the session-opened callback. Doing
      // it here (instead of inside the planner) keeps the SHA-256 cost
      // to one invocation and gives the persistence layer a direct
      // handle to the lookup key.
      const fingerprint: string | null = (resumable && file instanceof File && fingerprinter)
        ? await fingerprinter.fingerprint(file)
        : null;

      if (isStale()) {
        throw new UploadAbortedError();
      }

      const plan = (resumable && persistence && fingerprint)
        ? await resolveResumePlan({
            fingerprint,
            persistence,
            ctx,
            onResumeDetected: opts.onResumeDetected,
            signal: controller.signal
          })
        : undefined;

      if (isStale()) {
        throw new UploadAbortedError();
      }

      const uploader = new Uploader(http, file, {
        ...opts,
        init: { ...opts.init, ...init },
        onStatusChange: status => {
          // Guard against stale-uploader notifications. If a newer
          // upload() has already swapped uploaderRef, our state writes
          // would clobber the live one and our persistence.remove
          // would erase a record the live uploader just wrote.
          if (uploaderRef.current !== uploader) {
            return;
          }

          // The persisted record is only useful while the upload is in
          // flight. Drop it on success (the upload is done) and on
          // user-initiated abort (the user explicitly walked away).
          // We intentionally do NOT clear on "failed" — the upload may
          // resume after the user retries. resolveResumePlan handles
          // the cleanup for records pointing at swept claims.
          if (persistence && fingerprint && (status === "succeeded" || status === "aborted")) {
            void persistence.remove(fingerprint);
          }

          notify({ status });
          opts.onStatusChange?.(status);
        },
        onProgress: progress => {
          if (uploaderRef.current !== uploader) {
            return;
          }

          notify({ progress });
          opts.onProgress?.(progress);
        },
        onSessionOpened: session => {
          if (uploaderRef.current !== uploader) {
            return;
          }

          // Persist (or refresh) the record at the earliest opportunity
          // so a crash mid-upload still leaves something to resume from.
          // Fires on both fresh and resume paths — the Uploader carries
          // the original `expiresAt` through both, so this write is
          // always valid.
          //
          // On the resume path the first progress emission will jump
          // straight to `partsCompleted = skipParts.size` and `loaded`
          // = total bytes of completed parts (NOT zero) — consumers
          // rendering a progress bar should treat that initial value
          // as the starting position rather than "regressed".
          if (persistence && fingerprint) {
            void persistence.save({
              fingerprint,
              claimId: session.claimId,
              key: session.key,
              partSize: session.partSize,
              partCount: session.partCount,
              expiresAt: session.expiresAt,
              savedAt: Date.now()
            });
          }
        }
      });

      const previous = uploaderRef.current;
      uploaderRef.current = uploader;

      if (previous && ACTIVE_STATUSES.has(previous.status)) {
        await previous.abort();
      }

      // Final stale check before launch: if another upload() superseded
      // us during the abort wait, surrender without starting.
      if (isStale()) {
        if (uploaderRef.current === uploader) {
          uploaderRef.current = previous;
        }

        throw new UploadAbortedError();
      }

      notify({
        status: "idle",
        progress: {
          loaded: 0,
          total: file.size,
          partsCompleted: 0,
          partsTotal: 0,
          percent: 0
        },
        error: null,
        result: null
      });

      try {
        const result = await uploader.start(plan);
        notify({ result });
        opts.onSuccess?.(result);
        return result;
      } catch (error) {
        const typed = error as UploadError;

        // Resume started but the run still failed — the most likely
        // cause is the backend claim was swept between list_parts and
        // upload_part (or the file changed under us). Drop the local
        // record so the next attempt is a clean fresh upload instead
        // of looping on the same dead claim.
        if (plan?.kind === "resume" && persistence && fingerprint && uploaderRef.current === uploader) {
          void persistence.remove(fingerprint);
        }

        if (uploaderRef.current === uploader) {
          notify({ error: typed });
          opts.onError?.(typed);
        }

        throw typed;
      }
    },
    [http, notify, optionsRef]
  );

  const abort = useCallback(() => {
    // Cancel the pre-launch phase too (a hung list_parts would
    // otherwise leave a "stuck on initializing" UI even after abort).
    prelaunchControllerRef.current?.abort();

    const { current } = uploaderRef;

    if (current && ACTIVE_STATUSES.has(current.status)) {
      void current.abort();
    }
  }, []);

  const reset = useCallback(() => {
    // Bump the generation so any in-flight upload() that has not yet
    // started its Uploader sees `isStale()` and surrenders.
    genRef.current++;
    prelaunchControllerRef.current?.abort();

    const { current } = uploaderRef;

    if (current && ACTIVE_STATUSES.has(current.status)) {
      void current.abort();
    }

    uploaderRef.current = null;
    notify(initialState());
  }, [notify]);

  // Cancel any in-flight upload on unmount to avoid lingering XHRs.
  useEffect(() => () => {
    prelaunchControllerRef.current?.abort();

    const { current } = uploaderRef;

    if (current && ACTIVE_STATUSES.has(current.status)) {
      void current.abort();
    }
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return useMemo<UseUploadResult>(
    () => {
      return {
        upload,
        abort,
        reset,
        status: state.status,
        progress: state.progress,
        error: state.error,
        result: state.result,
        isUploading: ACTIVE_STATUSES.has(state.status)
      };
    },
    [upload, abort, reset, state]
  );
}
