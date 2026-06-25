import type { ApiResult, HttpClient } from "../../http";
import type { ListedPart, ProtocolContext } from "../protocol";
import type { ResumablePersistence, ResumeRecord } from "./persistence";
import type { ResumeCandidate, ResumeDecision } from "./plan";

import { DEFAULT_API_PATH, DEFAULT_RESOURCE, DEFAULT_VERSION } from "../protocol";
import { resolveResumePlan } from "./plan";

// ──────────────────────────────────────────────────────────────────────────
// Test doubles
// ──────────────────────────────────────────────────────────────────────────

function ok<T>(data: T): ApiResult<T> {
  return {
    code: 0,
    message: "ok",
    data
  };
}

interface FakeHttpHandle {
  http: Readonly<HttpClient>;
  actions: string[];
  listPartsResponses: Array<ListedPart[] | "error">;
}

/**
 * Minimal HttpClient stub. The list_parts hook is scripted via
 * `listPartsResponses`: each call consumes one entry. An "error"
 * entry simulates a protocol failure so the planner's fallback path
 * can be exercised. The fake refuses unknown actions so we can assert
 * no unexpected RPCs were dispatched.
 */
function makeFakeHttp(opts: { listPartsResponses?: Array<ListedPart[] | "error"> } = {}): FakeHttpHandle {
  const actions: string[] = [];
  const listPartsResponses = [...opts.listPartsResponses ?? []];

  const http = {
    post<T>(_url: string, options?: { data?: unknown }): Promise<ApiResult<T>> {
      const body = options?.data as { action: string };
      actions.push(body.action);

      if (body.action === "list_parts") {
        const next = listPartsResponses.shift();

        if (next === "error") {
          return Promise.reject(new Error("list_parts failed"));
        }

        return Promise.resolve(ok({ parts: next ?? [] }) as unknown as ApiResult<T>);
      }

      if (body.action === "abort_upload") {
        return Promise.resolve(ok(null) as unknown as ApiResult<T>);
      }

      return Promise.reject(new Error(`Unexpected action: ${body.action}`));
    },
    upload<T>(): Promise<ApiResult<T>> {
      return Promise.reject(new Error("upload should not be called from resolveResumePlan"));
    }
  } as unknown as Readonly<HttpClient>;

  return {
    http,
    actions,
    listPartsResponses
  };
}

/**
 * In-memory persistence so we can assert load/save/remove side effects
 * without touching localStorage. Mirrors the real interface.
 */
function makePersistence(initial?: ResumeRecord): ResumablePersistence & { snapshot: () => Record<string, ResumeRecord> } {
  const store = new Map<string, ResumeRecord>();

  if (initial) {
    store.set(initial.fingerprint, initial);
  }

  return {
    load(fingerprint) {
      return Promise.resolve(store.get(fingerprint) ?? null);
    },
    save(record) {
      store.set(record.fingerprint, record);
      return Promise.resolve();
    },
    remove(fingerprint) {
      store.delete(fingerprint);
      return Promise.resolve();
    },
    snapshot() {
      return Object.fromEntries(store);
    }
  };
}

function ctx(http: Readonly<HttpClient>): ProtocolContext {
  return {
    http,
    apiPath: DEFAULT_API_PATH,
    resource: DEFAULT_RESOURCE,
    version: DEFAULT_VERSION
  };
}

function futureIsoString(offsetMs = 60_000): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function pastIsoString(offsetMs = 60_000): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

function makeRecord(overrides: Partial<ResumeRecord> = {}): ResumeRecord {
  return {
    fingerprint: "fp",
    claimId: "claim-1",
    key: "priv/test.bin",
    partSize: 1024,
    partCount: 4,
    expiresAt: futureIsoString(),
    savedAt: 12_345,
    ...overrides
  };
}

// ──────────────────────────────────────────────────────────────────────────
// tests
// ──────────────────────────────────────────────────────────────────────────

describe("resolveResumePlan", () => {
  it("returns a fresh plan when no record is persisted", async () => {
    const { http, actions } = makeFakeHttp();
    const persistence = makePersistence();

    const plan = await resolveResumePlan({
      fingerprint: "fp",
      persistence,
      ctx: ctx(http)
    });

    expect(plan.kind).toBe("fresh");
    // No backend calls should be issued when there is nothing to resume.
    expect(actions).toEqual([]);
  });

  it("discards an expired record without calling list_parts", async () => {
    const { http, actions } = makeFakeHttp();
    const persistence = makePersistence(makeRecord({ expiresAt: pastIsoString() }));

    const plan = await resolveResumePlan({
      fingerprint: "fp",
      persistence,
      ctx: ctx(http)
    });

    expect(plan.kind).toBe("fresh");
    expect(persistence.snapshot()).toEqual({});
    expect(actions).toEqual([]);
  });

  it("drops the record and falls back to fresh when list_parts errors", async () => {
    const { http, actions } = makeFakeHttp({ listPartsResponses: ["error"] });
    const persistence = makePersistence(makeRecord());

    const plan = await resolveResumePlan({
      fingerprint: "fp",
      persistence,
      ctx: ctx(http)
    });

    expect(plan.kind).toBe("fresh");
    expect(persistence.snapshot()).toEqual({});
    expect(actions).toEqual(["list_parts"]);
  });

  it("defaults to discard when the caller does not supply a decision handler", async () => {
    const { http, actions } = makeFakeHttp({ listPartsResponses: [[{ partNumber: 1, size: 1024 }, { partNumber: 2, size: 1024 }]] });
    const persistence = makePersistence(makeRecord());

    const plan = await resolveResumePlan({
      fingerprint: "fp",
      persistence,
      ctx: ctx(http)
    });

    expect(plan.kind).toBe("fresh");
    expect(persistence.snapshot()).toEqual({});
    // Discard removes the record before issuing abort, but both calls
    // are awaited — so the dispatched action order is still list_parts
    // then abort_upload.
    expect(actions).toEqual(["list_parts", "abort_upload"]);
  });

  it("returns a resume plan carrying the live completed-parts list and original expiresAt", async () => {
    const { http, actions } = makeFakeHttp({ listPartsResponses: [[{ partNumber: 1, size: 1024 }, { partNumber: 3, size: 512 }]] });
    const seed = makeRecord();
    const persistence = makePersistence(seed);

    const plan = await resolveResumePlan({
      fingerprint: "fp",
      persistence,
      ctx: ctx(http),
      onResumeDetected: () => Promise.resolve<ResumeDecision>({ kind: "resume" })
    });

    expect(plan.kind).toBe("resume");

    if (plan.kind === "resume") {
      expect(plan.claimId).toBe("claim-1");
      expect(plan.partSize).toBe(1024);
      expect(plan.partCount).toBe(4);
      expect(plan.expiresAt).toBe(seed.expiresAt);
      expect(plan.completedParts.map(p => p.partNumber).toSorted()).toEqual([1, 3]);
      // Sizes from list_parts must be preserved (not derived from partSize)
      // so the Uploader can seed completedBytes from authoritative values.
      expect(plan.completedParts.find(p => p.partNumber === 3)?.size).toBe(512);
    }

    // Persistence is intentionally NOT cleared on resume — useUpload
    // refreshes the record after init/uploads so a future interruption
    // can be resumed again.
    expect(persistence.snapshot()).toEqual({ fp: seed });
    expect(actions).toEqual(["list_parts"]);
  });

  it("passes the live candidate (record + listed parts) to the decision handler", async () => {
    const { http } = makeFakeHttp({ listPartsResponses: [[{ partNumber: 2, size: 1024 }]] });
    const persistence = makePersistence(makeRecord());

    const received: ResumeCandidate[] = [];

    await resolveResumePlan({
      fingerprint: "fp",
      persistence,
      ctx: ctx(http),
      onResumeDetected: candidate => {
        received.push(candidate);
        return Promise.resolve({ kind: "discard" });
      }
    });

    expect(received).toHaveLength(1);
    expect(received[0]!.record.claimId).toBe("claim-1");
    expect(received[0]!.completedParts).toEqual([{ partNumber: 2, size: 1024 }]);
  });
});
