import { PrefixFingerprinter, WeakFingerprinter } from "./fingerprint";

function makeFile(bytes: Uint8Array<ArrayBuffer>, name = "test.bin", lastModified = 1_700_000_000_000): File {
  return new File([bytes], name, { lastModified });
}

describe("WeakFingerprinter", () => {
  it("derives the fingerprint from name, size, and lastModified only", async () => {
    const fp = new WeakFingerprinter();

    const a = await fp.fingerprint(makeFile(new Uint8Array(100), "doc.pdf", 1));
    const b = await fp.fingerprint(makeFile(new Uint8Array(100), "doc.pdf", 1));
    expect(a).toBe(b);

    const c = await fp.fingerprint(makeFile(new Uint8Array(100), "doc.pdf", 2));
    expect(c).not.toBe(a);

    const d = await fp.fingerprint(makeFile(new Uint8Array(200), "doc.pdf", 1));
    expect(d).not.toBe(a);

    const e = await fp.fingerprint(makeFile(new Uint8Array(100), "other.pdf", 1));
    expect(e).not.toBe(a);
  });

  it("collides when content differs but metadata matches", async () => {
    // This is the documented weakness — same name/size/mtime but
    // different bytes still produce the same fingerprint.
    const fp = new WeakFingerprinter();

    const a = await fp.fingerprint(makeFile(new Uint8Array(8).fill(0x11)));
    const b = await fp.fingerprint(makeFile(new Uint8Array(8).fill(0x22)));
    expect(a).toBe(b);
  });
});

describe("PrefixFingerprinter", () => {
  // The jsdom environment we use exposes crypto.subtle, so we can run
  // the SHA-256 path directly. Skip cleanly if the environment lacks it.
  const supported = typeof crypto !== "undefined" && crypto.subtle !== undefined;

  it.skipIf(!supported)("distinguishes files whose content differs but metadata matches", async () => {
    const fp = new PrefixFingerprinter();

    const a = await fp.fingerprint(makeFile(new Uint8Array(8).fill(0x11)));
    const b = await fp.fingerprint(makeFile(new Uint8Array(8).fill(0x22)));
    expect(a).not.toBe(b);
  });

  it.skipIf(!supported)("returns identical fingerprints for byte-identical files", async () => {
    const fp = new PrefixFingerprinter();

    const bytes = new Uint8Array(8).fill(0xAB);
    const a = await fp.fingerprint(makeFile(bytes));
    const b = await fp.fingerprint(makeFile(bytes));
    expect(a).toBe(b);
  });
});
