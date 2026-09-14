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

function zeroKey(byteLength: number): string {
  // eslint-disable-next-line unicorn/prefer-uint8array-base64 -- Keep this test runnable on every Node version supported by the package.
  return btoa(String.fromCodePoint(...new Uint8Array(byteLength)));
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
});
