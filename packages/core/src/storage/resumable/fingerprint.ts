/**
 * Stable identifier for a file. Two `File` instances should produce the
 * same fingerprint iff a sensible resume policy can treat them as the
 * "same upload" — name, size, lastModified, and (for the default
 * implementation) the first 4 MiB of content.
 *
 * The fingerprint is used as a `ResumablePersistence` lookup key. It is
 * never sent to the server: resume detection is purely client-side, and
 * the backend's authority is the claim ID stored alongside the
 * fingerprint, not the fingerprint itself.
 */
export interface FileFingerprinter {
  fingerprint: (file: File) => Promise<string>;
}

/**
 * Fast, deterministic fingerprint derived from `name`, `size`, and
 * `lastModified`. Synchronous (wrapped in a resolved promise) and
 * always available — no `crypto.subtle`, no I/O.
 *
 * Trade-off: a user who replaces a file with different content but
 * keeps the same name, size, and mtime will collide. Use only when
 * the surrounding UI guarantees file identity by other means (e.g.
 * a controlled upload widget that locks the file once selected).
 */
export class WeakFingerprinter implements FileFingerprinter {
  public fingerprint(file: File): Promise<string> {
    return Promise.resolve(`${file.name}:${file.size}:${file.lastModified}`);
  }
}

/**
 * Default fingerprinter for the framework. Combines metadata
 * (name + size + lastModified) with the SHA-256 of the file's first
 * 4 MiB. Catches the common "same metadata, different content" case
 * (e.g. saving a new export over an old one) while keeping the hash
 * window small enough to run on the main thread (<50 ms for large
 * files) — no Web Worker needed.
 *
 * Requires `crypto.subtle`, which is available in all modern browsers
 * over HTTPS (including `localhost`). When `crypto.subtle` is not
 * available the constructor throws synchronously — callers should
 * fall back to `WeakFingerprinter` at that point.
 */
export class PrefixFingerprinter implements FileFingerprinter {
  static readonly defaultPrefixBytes = 4 * 1024 * 1024;

  readonly #prefixBytes: number;

  /**
   * @param prefixBytes - Override the prefix window size. The default
   * (4 MiB) is a balance between collision resistance and main-thread
   * cost; reducing it makes fingerprinting faster but more likely to
   * miss small content changes near the file's tail.
   */
  constructor(prefixBytes: number = PrefixFingerprinter.defaultPrefixBytes) {
    if (typeof crypto === "undefined" || crypto.subtle === undefined) {
      throw new TypeError("PrefixFingerprinter requires the Web Crypto API (crypto.subtle)");
    }

    this.#prefixBytes = prefixBytes;
  }

  public async fingerprint(file: File): Promise<string> {
    const prefix = file.slice(0, Math.min(this.#prefixBytes, file.size));
    const buffer = await prefix.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);

    return `${file.name}:${file.size}:${file.lastModified}:${toHex(digest)}`;
  }
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";

  for (const byte of bytes) {
    out += byte!.toString(16).padStart(2, "0");
  }

  return out;
}
