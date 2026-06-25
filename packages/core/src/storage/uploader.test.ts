import type { ApiResult, HttpClient, RequestOptions } from "../http";
import type {
  CompleteUploadResponse,
  InitUploadResponse,
  UploadPartResponse
} from "./protocol";

import { UploadAbortedError, UploadPartError, UploadProtocolError } from "./errors";
import { Uploader } from "./uploader";

// ──────────────────────────────────────────────────────────────────────────
// Test doubles
// ──────────────────────────────────────────────────────────────────────────

interface Deferred<T> {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  promise: Promise<T>;
}

/**
 * Build an externally-resolvable promise. Used to gate parts so tests can
 * observe in-flight counts before resolving.
 */
function defer<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    resolve,
    reject,
    promise
  };
}

/**
 * Yield `count` microtask ticks so background workers can make progress.
 */
async function flushMicrotasks(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
}

function ok<T>(data: T): ApiResult<T> {
  return {
    code: 0,
    message: "ok",
    data
  };
}

interface PartCall {
  partNumber: number;
  size: number;
  signal?: AbortSignal;
}

interface FakeHttpBehavior {
  /**
   * Backend-authoritative part size (defaults to 1024).
   */
  partSize?: number;
  /**
   * Override the init_upload response (or throw to simulate failure).
   */
  init?: (req: { filename: string; size: number; contentType?: string; public?: boolean }) => Partial<InitUploadResponse> | Promise<Partial<InitUploadResponse>>;
  /**
   * Custom per-part handler. Receives the part call and the current
   * attempt count (1-indexed). Return a UploadPartResponse to succeed,
   * throw to fail. Default is "always succeed".
   */
  uploadPart?: (call: PartCall, attempt: number) => Promise<UploadPartResponse> | UploadPartResponse;
  /**
   * Override complete_upload response (or throw).
   */
  complete?: () => Partial<CompleteUploadResponse> | Promise<Partial<CompleteUploadResponse>>;
  /**
   * Override list_parts response (resume path). Return the part numbers
   * the backend has accepted. Default is "no parts uploaded yet".
   */
  listParts?: (req: { claimId: string }) => number[] | Promise<number[]>;
}

interface FakeHttpHandle {
  http: Readonly<HttpClient>;
  /**
   * Ordered log of every action dispatched (resource:action).
   */
  actions: string[];
  /**
   * Raw recorded calls keyed by action; useful for shape assertions.
   */
  calls: {
    init: Array<{ filename: string; size: number; contentType?: string; public?: boolean }>;
    parts: PartCall[];
    complete: Array<{ claimId: string }>;
    abort: Array<{ claimId: string }>;
    listParts: Array<{ claimId: string }>;
  };
  /**
   * Map of partNumber → number of times PutPart was attempted.
   */
  partAttempts: Map<number, number>;
}

function makeFakeHttp(behavior: FakeHttpBehavior = {}): FakeHttpHandle {
  const actions: string[] = [];
  const calls: FakeHttpHandle["calls"] = {
    init: [],
    parts: [],
    complete: [],
    abort: [],
    listParts: []
  };
  const partAttempts = new Map<number, number>();
  const partSize = behavior.partSize ?? 1024;

  let claimId: string | undefined;

  async function postHandler(body: { resource: string; action: string; params: Record<string, unknown> }, _options?: RequestOptions): Promise<ApiResult> {
    actions.push(`${body.resource}:${body.action}`);

    switch (body.action) {
      case "init_upload": {
        const params = body.params as { filename: string; size: number; contentType?: string; public?: boolean };
        calls.init.push(params);

        const override = await behavior.init?.(params);
        claimId = override?.claimId ?? "claim-1";

        const response: InitUploadResponse = {
          key: override?.key ?? `priv/test/${claimId}.bin`,
          claimId,
          originalFilename: override?.originalFilename ?? params.filename,
          partSize: override?.partSize ?? partSize,
          partCount: override?.partCount ?? Math.max(1, Math.ceil(params.size / (override?.partSize ?? partSize))),
          expiresAt: override?.expiresAt ?? new Date(Date.now() + 60_000).toISOString()
        };

        return ok(response);
      }

      case "complete_upload": {
        const params = body.params as { claimId: string };
        calls.complete.push(params);

        const override = await behavior.complete?.();
        const response: CompleteUploadResponse = {
          bucket: override?.bucket ?? "test-bucket",
          key: override?.key ?? `priv/test/${claimId}.bin`,
          eTag: override?.eTag ?? "etag-final",
          size: override?.size ?? calls.parts.reduce((acc, p) => acc + p.size, 0),
          contentType: override?.contentType ?? "application/octet-stream",
          lastModified: override?.lastModified ?? new Date().toISOString(),
          originalFilename: override?.originalFilename ?? calls.init.at(-1)?.filename ?? "test.bin",
          metadata: override?.metadata
        };

        return ok(response);
      }

      case "abort_upload": {
        const params = body.params as { claimId: string };
        calls.abort.push(params);
        return ok(null);
      }

      case "list_parts": {
        const params = body.params as { claimId: string };
        calls.listParts.push(params);

        const partNumbers = await (behavior.listParts?.(params) ?? []);
        return ok({
          parts: partNumbers.map(partNumber => { return { partNumber, size: partSize }; })
        });
      }

      default: {
        throw new Error(`Unexpected action: ${body.action}`);
      }
    }
  }

  async function uploadHandler(form: FormData, options?: { signal?: AbortSignal }): Promise<ApiResult<UploadPartResponse>> {
    const params = JSON.parse(String(form.get("params"))) as { claimId: string; partNumber: number };
    const { partNumber } = params;
    const blob = form.get("file") as Blob;
    const partClaimId = params.claimId;
    actions.push(`${String(form.get("resource"))}:${String(form.get("action"))}`);

    const attempt = (partAttempts.get(partNumber) ?? 0) + 1;
    partAttempts.set(partNumber, attempt);

    const call: PartCall = {
      partNumber,
      size: blob.size,
      signal: options?.signal
    };
    calls.parts.push(call);

    // claimId is captured during init_upload, but the resume path skips
    // init — so the first upload_part on the resume path adopts the
    // claim observed on the wire. Subsequent parts must agree with
    // that value; mismatches still fail the test loudly.
    if (claimId === undefined) {
      claimId = partClaimId;
    } else if (partClaimId !== claimId) {
      throw new Error(`claimId mismatch: got ${partClaimId}, expected ${claimId}`);
    }

    const behaviorCall = behavior.uploadPart
      ? Promise.resolve(behavior.uploadPart(call, attempt))
      : Promise.resolve({ partNumber, size: blob.size });

    // Race the behavior against the request's abort signal so the fake
    // mirrors what axios does in production: a held PutPart is cancelled
    // the moment the controller aborts.
    const signal = options?.signal;

    if (signal) {
      if (signal.aborted) {
        throw new DOMException("aborted", "AbortError");
      }

      const response = await new Promise<UploadPartResponse>((resolve, reject) => {
        const onAbort = (): void => reject(new DOMException("aborted", "AbortError"));
        signal.addEventListener("abort", onAbort, { once: true });
        behaviorCall.then(
          value => {
            signal.removeEventListener("abort", onAbort);
            resolve(value);
          },
          error => {
            signal.removeEventListener("abort", onAbort);
            reject(error);
          }
        );
      });
      return ok(response);
    }

    return ok(await behaviorCall);
  }

  const http = {
    post(_url: string, options?: { data?: unknown; signal?: AbortSignal }) {
      return postHandler(options?.data as { resource: string; action: string; params: Record<string, unknown> }, options);
    },
    upload(_url: string, options?: { data: FormData; onProgress?: unknown; signal?: AbortSignal }) {
      if (!options?.data) {
        return Promise.reject(new Error("upload called without data"));
      }

      return uploadHandler(options.data, options);
    }
  } as unknown as Readonly<HttpClient>;

  return {
    http,
    actions,
    calls,
    partAttempts
  };
}

function makeFile(bytes: number, name = "test.bin", type = "application/octet-stream"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

// ──────────────────────────────────────────────────────────────────────────
// init / happy path
// ──────────────────────────────────────────────────────────────────────────

describe("Uploader / init", () => {
  it("forwards filename, size, contentType, and public flag to init_upload", async () => {
    const { http, calls } = makeFakeHttp({ partSize: 1024 });
    await new Uploader(http, makeFile(2048, "photo.jpg", "image/jpeg"), { init: { public: true } }).start();

    expect(calls.init).toEqual([
      {
        filename: "photo.jpg",
        size: 2048,
        contentType: "image/jpeg",
        public: true
      }
    ]);
  });

  it("uses the backend-authoritative partSize and partCount even if the caller's plan differs", async () => {
    const { http, calls } = makeFakeHttp({
      init: () => { return { partSize: 500, partCount: 3 }; }
    });
    // File is 1.2 KB but the backend says use 500-byte parts → 3 parts.
    await new Uploader(http, makeFile(1200)).start();

    expect(calls.parts.map(p => p.partNumber)).toEqual([1, 2, 3]);
    expect(calls.parts.map(p => p.size)).toEqual([500, 500, 200]);
  });

  it("rejects with UploadProtocolError when init_upload fails and does NOT call abort_upload", async () => {
    const { http, calls } = makeFakeHttp({
      init: () => {
        throw new Error("backend down");
      }
    });

    await expect(new Uploader(http, makeFile(1024)).start()).rejects.toBeInstanceOf(UploadProtocolError);
    // No claim was ever opened, so abort_upload must NOT have been called.
    expect(calls.abort).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// concurrency
// ──────────────────────────────────────────────────────────────────────────

describe("Uploader / concurrency", () => {
  it("dispatches up to partConcurrency parts in parallel", async () => {
    const inFlight = new Set<number>();
    let maxObserved = 0;

    // Resolve each part only after every concurrent slot has been claimed.
    // Using deferred promises lets us observe the in-flight peak before the
    // first part completes.
    const deferreds = new Map<number, Deferred<void>>();

    for (let i = 1; i <= 5; i++) {
      deferreds.set(i, defer<void>());
    }

    const { http } = makeFakeHttp({
      partSize: 100,
      init: () => { return { partCount: 5 }; },
      uploadPart: async ({ partNumber, size }) => {
        inFlight.add(partNumber);
        maxObserved = Math.max(maxObserved, inFlight.size);
        await deferreds.get(partNumber)!.promise;
        inFlight.delete(partNumber);
        return { partNumber, size };
      }
    });

    const uploader = new Uploader(http, makeFile(500), { partConcurrency: 3 });
    const done = uploader.start();

    // Yield several microtask ticks so the workers can claim parts.
    await flushMicrotasks(10);

    expect(maxObserved).toBe(3);

    // Release all gated parts so the upload can finalize.
    for (const d of deferreds.values()) {
      d.resolve();
    }

    await done;

    // After all parts complete, the peak should still be 3 (never more,
    // never less when there are 5 parts and capacity 3).
    expect(maxObserved).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// retry
// ──────────────────────────────────────────────────────────────────────────

describe("Uploader / retry", () => {
  it("retries a flaky part and succeeds on a later attempt", async () => {
    const { http, partAttempts } = makeFakeHttp({
      partSize: 1024,
      init: () => { return { partCount: 2 }; },
      uploadPart: ({ partNumber, size }, attempt) => {
        // Part 2 fails the first two attempts, succeeds on the third.
        if (partNumber === 2 && attempt < 3) {
          throw new Error(`transient ${attempt}`);
        }

        return { partNumber, size };
      }
    });

    const uploader = new Uploader(http, makeFile(2048), {
      maxPartRetries: 3,
      retryBaseDelay: 0,
      retryMaxDelay: 0
    });

    await expect(uploader.start()).resolves.toMatchObject({ originalFilename: "test.bin" });
    expect(partAttempts.get(1)).toBe(1);
    expect(partAttempts.get(2)).toBe(3);
  });

  it("wraps a part that exhausts its retry budget in UploadPartError and keeps the session alive for resume", async () => {
    const { http, calls } = makeFakeHttp({
      partSize: 1024,
      init: () => { return { partCount: 2 }; },
      uploadPart: ({ partNumber, size }) => {
        if (partNumber === 2) {
          throw new Error("permanent");
        }

        return { partNumber, size };
      }
    });

    const uploader = new Uploader(http, makeFile(2048), {
      maxPartRetries: 2,
      retryBaseDelay: 0,
      retryMaxDelay: 0
    });

    const caught = await uploader.start().then(() => null, (error: unknown) => error);
    expect(caught).toBeInstanceOf(UploadPartError);
    expect((caught as UploadPartError).partNumber).toBe(2);
    expect((caught as UploadPartError).attempts).toBe(2);

    // A non-abort failure (UploadPartError) MUST NOT destroy the server
    // session — the persisted record still points at this claim and a
    // future resume must be able to reach it.
    expect(calls.abort).toEqual([]);
    expect(uploader.status).toBe("failed");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// abort
// ──────────────────────────────────────────────────────────────────────────

describe("Uploader / abort", () => {
  it("abort() during upload triggers abort_upload and rejects with UploadAbortedError", async () => {
    // Hold parts open until the test explicitly releases them so abort()
    // can fire while the upload is genuinely in flight.
    const partsStarted: Array<Deferred<void>> = [];

    const { http, calls } = makeFakeHttp({
      partSize: 100,
      init: () => { return { partCount: 5 }; },
      uploadPart: async () => {
        const gate = defer<void>();
        partsStarted.push(gate);
        await gate.promise;

        // Should never reach here in this test — abort fires first.
        return { partNumber: 0, size: 0 };
      }
    });

    const uploader = new Uploader(http, makeFile(500), { partConcurrency: 2 });
    const done = uploader.start().catch(error => error as unknown);

    // Wait for at least one part to enter the gate.
    for (let i = 0; i < 20 && partsStarted.length === 0; i++) {
      await Promise.resolve();
    }

    expect(partsStarted.length).toBeGreaterThan(0);

    await uploader.abort();

    const error = await done;
    expect(error).toBeInstanceOf(UploadAbortedError);
    expect(uploader.status).toBe("aborted");
    expect(calls.abort).toEqual([{ claimId: "claim-1" }]);
  });

  it("external AbortSignal triggers the same cleanup path as abort()", async () => {
    const partsStarted: Array<Deferred<void>> = [];

    const { http, calls } = makeFakeHttp({
      partSize: 100,
      init: () => { return { partCount: 3 }; },
      uploadPart: async () => {
        const gate = defer<void>();
        partsStarted.push(gate);
        await gate.promise;
        return { partNumber: 0, size: 0 };
      }
    });

    const controller = new AbortController();
    const uploader = new Uploader(http, makeFile(300), { signal: controller.signal });
    const done = uploader.start().catch(error => error as unknown);

    for (let i = 0; i < 20 && partsStarted.length === 0; i++) {
      await Promise.resolve();
    }

    controller.abort();

    const error = await done;
    expect(error).toBeInstanceOf(UploadAbortedError);
    expect(calls.abort).toEqual([{ claimId: "claim-1" }]);
  });

  it("aborts cleanly when the external signal is already aborted at construction time", async () => {
    const { http, calls } = makeFakeHttp();
    const controller = new AbortController();
    controller.abort();

    const uploader = new Uploader(http, makeFile(2048), { signal: controller.signal });

    await expect(uploader.start()).rejects.toBeInstanceOf(UploadAbortedError);
    // init never ran, so no claim was opened, so abort_upload must not be called.
    expect(calls.init).toEqual([]);
    expect(calls.abort).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// progress + status transitions
// ──────────────────────────────────────────────────────────────────────────

describe("Uploader / progress + status", () => {
  it("transitions idle → initializing → uploading → completing → succeeded on success", async () => {
    const { http } = makeFakeHttp({
      partSize: 512,
      init: () => {
        return { partCount: 2 };
      }
    });
    const statuses: string[] = [];

    const uploader = new Uploader(http, makeFile(1024), {
      onStatusChange: s => statuses.push(s)
    });
    await uploader.start();

    expect(statuses).toEqual(["initializing", "uploading", "completing", "succeeded"]);
    expect(uploader.status).toBe("succeeded");
  });

  it("emits monotonic non-decreasing loaded bytes and ends at 100%", async () => {
    const { http } = makeFakeHttp({
      partSize: 512,
      init: () => {
        return { partCount: 4 };
      }
    });
    const progressLog: number[] = [];

    const uploader = new Uploader(http, makeFile(2048), {
      onProgress: p => progressLog.push(p.loaded)
    });
    await uploader.start();

    // The final emission must be the full size.
    expect(progressLog.at(-1)).toBe(2048);

    // Monotone non-decreasing throughout.
    for (let i = 1; i < progressLog.length; i++) {
      expect(progressLog[i]).toBeGreaterThanOrEqual(progressLog[i - 1]!);
    }

    expect(uploader.progress.percent).toBe(100);
    expect(uploader.progress.partsCompleted).toBe(4);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// idempotent abort / re-entrancy
// ──────────────────────────────────────────────────────────────────────────

describe("Uploader / re-entrancy", () => {
  it("start() called twice returns the same promise", () => {
    const { http } = makeFakeHttp();
    const uploader = new Uploader(http, makeFile(1024));

    expect(uploader.start()).toBe(uploader.start());
  });

  it("abort() on a terminal uploader is a no-op", async () => {
    const { http, calls } = makeFakeHttp();
    const uploader = new Uploader(http, makeFile(1024));
    await uploader.start();

    // No abort_upload call should have been issued — the session completed.
    await uploader.abort();
    expect(calls.abort).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// resume
// ──────────────────────────────────────────────────────────────────────────

describe("Uploader / resume", () => {
  it("skips init_upload and re-uploads only the missing parts", async () => {
    const {
      http,
      calls,
      actions
    } = makeFakeHttp({ partSize: 1024 });

    // 4 parts total, parts 1 and 3 already uploaded server-side.
    const uploader = new Uploader(http, makeFile(4096));
    const result = await uploader.start({
      kind: "resume",
      claimId: "claim-resumed",
      key: "priv/resume/test.bin",
      partSize: 1024,
      partCount: 4,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      completedParts: [
        { partNumber: 1, size: 1024 },
        { partNumber: 3, size: 1024 }
      ]
    });

    expect(calls.init).toEqual([]);
    expect(actions).not.toContain("sys/storage:init_upload");
    expect(calls.parts.map(p => p.partNumber).toSorted()).toEqual([2, 4]);
    expect(calls.complete).toEqual([{ claimId: "claim-resumed" }]);
    expect(result.originalFilename).toBe("test.bin");
  });

  it("seeds progress from list_parts sizes — not from local file slicing", async () => {
    const { http } = makeFakeHttp({ partSize: 1024 });
    const progressLog: number[] = [];

    // File is 4 KiB, plan says parts 1 and 2 (each 1 KiB) are done →
    // 2048 bytes should be credited up front from the listed sizes,
    // independent of how the local Blob would slice.
    const uploader = new Uploader(http, makeFile(4096), {
      onProgress: p => progressLog.push(p.loaded)
    });
    await uploader.start({
      kind: "resume",
      claimId: "claim-resumed",
      key: "priv/resume/test.bin",
      partSize: 1024,
      partCount: 4,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      completedParts: [
        { partNumber: 1, size: 1024 },
        { partNumber: 2, size: 1024 }
      ]
    });

    // First emission should already credit the 2048 bytes that were
    // uploaded in the prior session.
    expect(progressLog[0]).toBeGreaterThanOrEqual(2048);
    expect(progressLog.at(-1)).toBe(4096);
    expect(uploader.progress.partsCompleted).toBe(4);
  });

  it("forwards the resume expiresAt to onSessionOpened so the hook can refresh the record", async () => {
    const { http } = makeFakeHttp({ partSize: 1024 });
    const sessions: Array<{ claimId: string; expiresAt: string }> = [];

    const expectedExpiry = new Date(Date.now() + 60_000).toISOString();

    await new Uploader(http, makeFile(2048), {
      onSessionOpened: snapshot => sessions.push({ claimId: snapshot.claimId, expiresAt: snapshot.expiresAt })
    }).start({
      kind: "resume",
      claimId: "claim-resumed",
      key: "priv/resume/test.bin",
      partSize: 1024,
      partCount: 2,
      expiresAt: expectedExpiry,
      completedParts: [{ partNumber: 1, size: 1024 }]
    });

    expect(sessions).toEqual([{ claimId: "claim-resumed", expiresAt: expectedExpiry }]);
  });

  it("rejects a resume plan whose part window cannot fit the file size", async () => {
    const { http, calls } = makeFakeHttp({ partSize: 1024 });

    // File is 4 KiB but the saved plan claims 6 parts × 1 KiB.
    // The minimum valid file size for that plan is 5 KiB + 1 byte.
    const uploader = new Uploader(http, makeFile(4096));
    await expect(
      uploader.start({
        kind: "resume",
        claimId: "claim-stale",
        key: "priv/resume/stale.bin",
        partSize: 1024,
        partCount: 6,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        completedParts: [{ partNumber: 1, size: 1024 }]
      })
    ).rejects.toBeInstanceOf(UploadProtocolError);

    // No init_upload, no upload_part — we tripped the size guard
    // before reaching the worker pool.
    expect(calls.init).toEqual([]);
    expect(calls.parts).toEqual([]);
  });

  it("falls back to init_upload when started with a fresh plan", async () => {
    const { http, calls } = makeFakeHttp({ partSize: 1024 });

    const uploader = new Uploader(http, makeFile(2048));
    await uploader.start({ kind: "fresh" });

    expect(calls.init).toHaveLength(1);
    expect(calls.parts.map(p => p.partNumber).toSorted()).toEqual([1, 2]);
  });
});
