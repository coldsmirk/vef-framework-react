import { encodeRequestBody, ProtectedBodyCodec } from "./body-encoding";

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  const written = writer.write(bytes).then(() => writer.close());

  const [inflated] = await Promise.all([
    new Response(stream.readable).arrayBuffer(),
    written
  ]);

  return new Uint8Array(inflated);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  // eslint-disable-next-line unicorn/prefer-uint8array-base64 -- Browser support for Uint8Array.fromBase64 is still not universal.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index)!;
  }

  return bytes;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  // eslint-disable-next-line unicorn/prefer-uint8array-base64 -- Keep this test runnable on every Node version supported by the package.
  return btoa(String.fromCodePoint(...bytes));
}

function zeroKey(byteLength: number): string {
  return bytesToBase64(new Uint8Array(byteLength));
}

// Captured before any spec hides `crypto.subtle`, so Web Crypto stays available
// as an independent reference for the portable cipher.
const nativeCrypto = crypto;

function importReferenceKey(key: string): Promise<CryptoKey> {
  return nativeCrypto.subtle.importKey("raw", base64ToBytes(key), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function referenceEncrypt(payload: string, key: string): Promise<string> {
  const nonce = nativeCrypto.getRandomValues(new Uint8Array(12));
  const sealed = await nativeCrypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    await importReferenceKey(key),
    new TextEncoder().encode(payload)
  );

  return bytesToBase64(new Uint8Array([...nonce, ...new Uint8Array(sealed)]));
}

async function referenceDecrypt(encoded: string, key: string): Promise<string> {
  const wire = base64ToBytes(encoded);
  const plaintext = await nativeCrypto.subtle.decrypt(
    { name: "AES-GCM", iv: wire.slice(0, 12) },
    await importReferenceKey(key),
    wire.slice(12)
  );

  return decodeUtf8(new Uint8Array(plaintext));
}

describe("http/encodeRequestBody", () => {
  it("base64-encodes the payload and reports the encoding", async () => {
    const payload = JSON.stringify({ resource: "integration/adapter", action: "save" });

    const { body, encoding } = await encodeRequestBody(payload, "base64");

    expect(encoding).toBe("base64");
    expect(decodeUtf8(base64ToBytes(body))).toBe(payload);
  });

  it("gzips then base64-encodes the payload and reports the encoding", async () => {
    const payload = JSON.stringify({ script: "return input.value * 2;" });

    const { body, encoding } = await encodeRequestBody(payload, "gzip+base64");
    const inflated = await gunzip(base64ToBytes(body));

    expect(encoding).toBe("gzip+base64");
    expect(decodeUtf8(inflated)).toBe(payload);
  });

  it("round-trips a non-ASCII payload through base64", async () => {
    const payload = JSON.stringify({ note: "国密 SM4 适配器脚本" });

    const { body } = await encodeRequestBody(payload, "base64");

    expect(decodeUtf8(base64ToBytes(body))).toBe(payload);
  });

  describe("when the runtime cannot gzip", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("falls back to base64 and reports the applied encoding", async () => {
      vi.stubGlobal("CompressionStream", undefined);
      const payload = JSON.stringify({ script: "return input;" });

      const { body, encoding } = await encodeRequestBody(payload, "gzip+base64");

      expect(encoding).toBe("base64");
      expect(decodeUtf8(base64ToBytes(body))).toBe(payload);
    });
  });

  // The native Uint8Array#toBase64 is absent on the Node versions and browsers
  // this library still targets, so the btoa fallback must produce correct
  // base64 even where a modern local runtime would use the native method.
  describe("without the native Uint8Array base64 method", () => {
    let nativeToBase64: unknown;

    beforeEach(() => {
      nativeToBase64 = Reflect.get(Uint8Array.prototype, "toBase64");
      Reflect.deleteProperty(Uint8Array.prototype, "toBase64");
    });

    afterEach(() => {
      if (nativeToBase64 !== undefined) {
        Reflect.set(Uint8Array.prototype, "toBase64", nativeToBase64);
      }
    });

    it("falls back to btoa and still produces decodable base64", async () => {
      const payload = JSON.stringify({ note: "国密 SM4 适配器脚本" });

      const { body } = await encodeRequestBody(payload, "base64");

      expect(decodeUtf8(base64ToBytes(body))).toBe(payload);
    });
  });
});

describe("http/ProtectedBodyCodec", () => {
  it("round-trips UTF-8 JSON with the Go-compatible AES-GCM layout", async () => {
    const codec = new ProtectedBodyCodec({
      encoding: "aes-gcm+base64",
      key: zeroKey(32)
    });
    const payload = JSON.stringify({
      code: 0,
      message: "success ✓",
      data: { id: 1 }
    });

    const encoded = await codec.encode(payload);
    const wire = base64ToBytes(encoded);

    expect(wire.byteLength).toBe(12 + new TextEncoder().encode(payload).byteLength + 16);
    await expect(codec.decode(encoded)).resolves.toBe(payload);
  });

  it("uses a fresh nonce for each body", async () => {
    const codec = new ProtectedBodyCodec({
      encoding: "aes-gcm+base64",
      key: zeroKey(16)
    });

    const first = await codec.encode("same payload");
    const second = await codec.encode("same payload");

    expect(first).not.toBe(second);
  });

  it("rejects a tampered authenticated body", async () => {
    const codec = new ProtectedBodyCodec({
      encoding: "aes-gcm+base64",
      key: zeroKey(24)
    });
    const wire = base64ToBytes(await codec.encode("sensitive"));
    wire[wire.length - 1] = wire.at(-1)! ^ 1;

    // eslint-disable-next-line unicorn/prefer-uint8array-base64 -- Browser support for Uint8Array#toBase64 is still not universal.
    const tampered = btoa(String.fromCodePoint(...wire));

    await expect(codec.decode(tampered)).rejects.toThrow();
  });

  it("rejects malformed and incorrectly sized keys", () => {
    expect(() => new ProtectedBodyCodec({ encoding: "aes-gcm+base64", key: "not-base64" })).toThrow(
      "standard padded base64"
    );
    expect(() => new ProtectedBodyCodec({ encoding: "aes-gcm+base64", key: zeroKey(15) })).toThrow(
      "16, 24, or 32 bytes"
    );
  });

  // Browsers expose `crypto.subtle` only in secure contexts, so a page served
  // over plain HTTP sees `getRandomValues` alone.
  describe("when the runtime hides crypto.subtle", () => {
    const key = zeroKey(32);
    const payload = JSON.stringify({
      code: 0,
      message: "success ✓",
      data: { id: 1 }
    });

    beforeEach(() => {
      vi.stubGlobal("crypto", { getRandomValues: nativeCrypto.getRandomValues.bind(nativeCrypto) });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("encodes bodies that Web Crypto decrypts", async () => {
      const codec = new ProtectedBodyCodec({ encoding: "aes-gcm+base64", key });

      const encoded = await codec.encode(payload);

      await expect(referenceDecrypt(encoded, key)).resolves.toBe(payload);
    });

    it("decodes bodies that Web Crypto encrypted", async () => {
      const codec = new ProtectedBodyCodec({ encoding: "aes-gcm+base64", key });

      const encoded = await referenceEncrypt(payload, key);

      await expect(codec.decode(encoded)).resolves.toBe(payload);
    });

    it("rejects a tampered authenticated body", async () => {
      const codec = new ProtectedBodyCodec({ encoding: "aes-gcm+base64", key });
      const wire = base64ToBytes(await codec.encode(payload));
      wire[wire.length - 1] = wire.at(-1)! ^ 1;

      await expect(codec.decode(bytesToBase64(wire))).rejects.toThrow();
    });
  });
});
