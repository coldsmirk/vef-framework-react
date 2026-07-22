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

    return { body: compressed.toBase64(), encoding: "gzip+base64" };
  }

  return { body: utf8.toBase64(), encoding: "base64" };
}
