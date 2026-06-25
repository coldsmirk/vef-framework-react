import type { ResumeRecord } from "./persistence";

import { LocalStoragePersistence } from "./persistence";

function makeRecord(overrides: Partial<ResumeRecord> = {}): ResumeRecord {
  return {
    fingerprint: "fp-test",
    claimId: "claim-1",
    key: "priv/test.bin",
    partSize: 1024,
    partCount: 4,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    savedAt: Date.now(),
    ...overrides
  };
}

describe("LocalStoragePersistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no record exists for the fingerprint", async () => {
    const store = new LocalStoragePersistence();
    expect(await store.load("missing")).toBeNull();
  });

  it("round-trips a saved record", async () => {
    const store = new LocalStoragePersistence();
    const record = makeRecord();

    await store.save(record);
    const loaded = await store.load(record.fingerprint);

    expect(loaded).toEqual(record);
  });

  it("removes the record by fingerprint", async () => {
    const store = new LocalStoragePersistence();
    const record = makeRecord();

    await store.save(record);
    await store.remove(record.fingerprint);

    expect(await store.load(record.fingerprint)).toBeNull();
  });

  it("returns null when the stored payload is structurally invalid", async () => {
    // Write a payload that's missing required fields. The implementation
    // must treat this as "no record" rather than crashing — guards
    // against format drift between releases.
    localStorage.setItem("__VEF_UPLOAD_RESUME__bad", JSON.stringify({ claimId: "x" }));

    const store = new LocalStoragePersistence();
    expect(await store.load("bad")).toBeNull();
  });

  it("returns null when the stored payload is not valid JSON", async () => {
    localStorage.setItem("__VEF_UPLOAD_RESUME__broken", "not json");

    const store = new LocalStoragePersistence();
    expect(await store.load("broken")).toBeNull();
  });

  it("namespaces keys under the configured prefix", async () => {
    const store = new LocalStoragePersistence("__custom__");
    const record = makeRecord();

    await store.save(record);

    expect(localStorage.getItem(`__custom__${record.fingerprint}`)).not.toBeNull();
    expect(localStorage.getItem(`__VEF_UPLOAD_RESUME__${record.fingerprint}`)).toBeNull();
  });
});
