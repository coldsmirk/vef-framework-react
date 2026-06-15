/**
 * A persisted upload session that can be matched against a re-opened file
 * to resume from where the previous attempt left off. The record carries
 * only what the client needs to call `list_parts` and rebuild the
 * Uploader's plan — the authoritative list of completed parts is always
 * fetched from the backend, never trusted from disk.
 */
export interface ResumeRecord {
  /**
   * Stable identifier of the file the session belongs to. Used by the
   * persistence layer as a lookup key. Computed by the `FileFingerprinter`.
   */
  fingerprint: string;
  /**
   * Server-assigned claim ID. Replays into `list_parts` / `upload_part`
   * — every framework RPC routes by claimId, never by the backend's
   * internal multipart upload ID.
   */
  claimId: string;
  /**
   * Object key the backend assigned for this upload. Recorded for
   * diagnostic purposes and parity with `InitUploadResponse`.
   */
  key: string;
  /**
   * Backend-authoritative part size. Persisted so the client can sanity-
   * check the saved record against the file size before resuming
   * (e.g. an out-of-date partSize indicates a configuration drift).
   */
  partSize: number;
  /**
   * Total number of parts the original `init_upload` planned for.
   */
  partCount: number;
  /**
   * Wall-clock expiry as an ISO-8601 string (mirrors
   * `InitUploadResponse.expiresAt`). Reading code MUST compare this
   * against `Date.now()` and discard expired records — the server-side
   * sweeper may have deleted the underlying claim already.
   */
  expiresAt: string;
  /**
   * Local timestamp (`Date.now()`) when the record was last written.
   * Not used for control flow; useful for diagnostics and future
   * cleanup policies.
   */
  savedAt: number;
}

/**
 * Pluggable persistence for `ResumeRecord` values. The default
 * implementation (`LocalStoragePersistence`) targets `localStorage`,
 * but the interface is intentionally async so callers can swap in
 * IndexedDB, a server-side session store (for cross-device resume),
 * or a multi-tenant namespaced backend.
 *
 * Implementations should be safe to call from any context (including
 * SSR — see `LocalStoragePersistence` for the typical guard pattern).
 * `load` MUST return `null` when no record exists; throwing is reserved
 * for genuine I/O failures the caller would want to surface.
 */
export interface ResumablePersistence {
  load: (fingerprint: string) => Promise<ResumeRecord | null>;
  save: (record: ResumeRecord) => Promise<void>;
  remove: (fingerprint: string) => Promise<void>;
}

const DEFAULT_KEY_PREFIX = "__VEF_UPLOAD_RESUME__";

/**
 * Default `ResumablePersistence` implementation backed by
 * `window.localStorage`. Keys are namespaced under `keyPrefix` (default
 * `__VEF_UPLOAD_RESUME__`) so resume records cannot collide with the
 * project's other localStorage consumers.
 *
 * The implementation is intentionally tolerant of structurally invalid
 * stored payloads — if a record fails to parse it is dropped and `load`
 * returns `null`, mirroring the "no record" case. This guards against
 * format drift between releases (we'd rather start a fresh upload than
 * crash on a stale row).
 */
export class LocalStoragePersistence implements ResumablePersistence {
  readonly #keyPrefix: string;

  constructor(keyPrefix: string = DEFAULT_KEY_PREFIX) {
    this.#keyPrefix = keyPrefix;
  }

  public load(fingerprint: string): Promise<ResumeRecord | null> {
    return Promise.resolve(this.#loadSync(fingerprint));
  }

  public save(record: ResumeRecord): Promise<void> {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(this.#storageKey(record.fingerprint), JSON.stringify(record));
    }

    return Promise.resolve();
  }

  public remove(fingerprint: string): Promise<void> {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(this.#storageKey(fingerprint));
    }

    return Promise.resolve();
  }

  /**
   * Drop every record this persistence instance owns (matched by the
   * configured key prefix). Call this on logout / account-switch so a
   * subsequent user does not inherit the previous user's resume
   * metadata — even though server-side ownership checks prevent
   * cross-user claim theft, leaving the records around still leaks
   * which keys the previous user had in flight (and, with the prefix
   * fingerprint, whether they had ever uploaded any of a given set of
   * candidate files).
   *
   * Foreign records (different prefix, unrelated localStorage entries)
   * are left untouched.
   */
  public clearAll(): Promise<void> {
    if (typeof localStorage === "undefined") {
      return Promise.resolve();
    }

    const drop: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key !== null && key.startsWith(this.#keyPrefix)) {
        drop.push(key);
      }
    }

    for (const key of drop) {
      localStorage.removeItem(key);
    }

    return Promise.resolve();
  }

  #loadSync(fingerprint: string): ResumeRecord | null {
    if (typeof localStorage === "undefined") {
      return null;
    }

    const raw = localStorage.getItem(this.#storageKey(fingerprint));

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ResumeRecord>;
      return isValidRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  #storageKey(fingerprint: string): string {
    return `${this.#keyPrefix}${fingerprint}`;
  }
}

/**
 * Structural validation for stored records. Required because
 * localStorage entries may have been written by an older release or
 * tampered with externally; the Uploader's invariants assume every
 * field is well-typed.
 */
function isValidRecord(value: Partial<ResumeRecord>): value is ResumeRecord {
  return (
    typeof value.fingerprint === "string"
    && typeof value.claimId === "string"
    && typeof value.key === "string"
    && typeof value.partSize === "number"
    && typeof value.partCount === "number"
    && typeof value.expiresAt === "string"
    && typeof value.savedAt === "number"
  );
}
