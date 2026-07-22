import { encodeRequestBody } from "./body-encoding";

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

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("http/encodeRequestBody", () => {
  it("base64-encodes the payload and reports the encoding", async () => {
    const payload = JSON.stringify({ resource: "integration/adapter", action: "save" });

    const { body, encoding } = await encodeRequestBody(payload, "base64");

    expect(encoding).toBe("base64");
    expect(decodeUtf8(Uint8Array.fromBase64(body))).toBe(payload);
  });

  it("gzips then base64-encodes the payload and reports the encoding", async () => {
    const payload = JSON.stringify({ script: "return input.value * 2;" });

    const { body, encoding } = await encodeRequestBody(payload, "gzip+base64");
    const inflated = await gunzip(Uint8Array.fromBase64(body));

    expect(encoding).toBe("gzip+base64");
    expect(decodeUtf8(inflated)).toBe(payload);
  });

  it("round-trips a non-ASCII payload through base64", async () => {
    const payload = JSON.stringify({ note: "国密 SM4 适配器脚本" });

    const { body } = await encodeRequestBody(payload, "base64");

    expect(decodeUtf8(Uint8Array.fromBase64(body))).toBe(payload);
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
      expect(decodeUtf8(Uint8Array.fromBase64(body))).toBe(payload);
    });
  });
});
