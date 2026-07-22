import type { BodyEncoding } from "./types";

/**
 * The transport encoding actually applied to a request body, paired with the
 * encoded text. `gzip+base64` degrades to `base64` when the runtime has no
 * `CompressionStream`, so the reported encoding can differ from the request.
 */
export interface EncodedRequestBody {
  body: string;
  encoding: Exclude<BodyEncoding, "none">;
}

/**
 * The slice size fed to `String.fromCodePoint`, kept under the argument-count
 * limit so encoding a large body cannot overflow the call stack.
 */
const BASE64_CHUNK_SIZE = 0x80_00;

/**
 * Encode raw bytes to standard base64, preferring the native `Uint8Array`
 * method where present and otherwise falling back to `btoa` — `toBase64` is not
 * yet available across every browser and Node version this library targets.
 */
function bytesToBase64(bytes: Uint8Array): string {
  if ("toBase64" in bytes && typeof bytes.toBase64 === "function") {
    return bytes.toBase64();
  }

  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
  }

  // eslint-disable-next-line unicorn/prefer-uint8array-base64 -- Browser support for Uint8Array#toBase64 is still not universal.
  return btoa(binary);
}

/**
 * Whether the runtime can gzip a request body.
 */
function canGzip(): boolean {
  return typeof CompressionStream !== "undefined";
}

/**
 * Gzip a byte payload through the platform `CompressionStream`, reading the
 * compressed side while the source is written so the single chunk cannot stall.
 */
async function gzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  const written = writer.write(bytes).then(() => writer.close());

  const [compressed] = await Promise.all([
    new Response(stream.readable).arrayBuffer(),
    written
  ]);

  return new Uint8Array(compressed);
}

/**
 * Encode a serialized JSON payload for transport so a code-shaped body (an
 * integration adapter or envelope/auth script) survives middleboxes that
 * false-positive on it; the server's body-encoding middleware reverses it
 * before parsing. `gzip+base64` compresses first — smaller on the wire and
 * still text-shaped — and falls back to `base64` when the runtime cannot gzip.
 */
export async function encodeRequestBody(
  payload: string,
  encoding: Exclude<BodyEncoding, "none">
): Promise<EncodedRequestBody> {
  // TextEncoder always allocates a fresh plain ArrayBuffer, so narrowing the
  // view's buffer type is sound and satisfies the stream/base64 byte APIs.
  const utf8 = new TextEncoder().encode(payload) as Uint8Array<ArrayBuffer>;

  if (encoding === "gzip+base64" && canGzip()) {
    const compressed = await gzip(utf8);

    return { body: bytesToBase64(compressed), encoding: "gzip+base64" };
  }

  return { body: bytesToBase64(utf8), encoding: "base64" };
}
