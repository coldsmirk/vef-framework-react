import type { Awaitable } from "@vef-framework-react/shared";

import type { BodyEncoding, ProtectedBodyEncodingOptions } from "./types";

import { gcm } from "@noble/ciphers/aes.js";

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
const AES_GCM_NONCE_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const STANDARD_BASE64_PATTERN = /^(?:[A-Z\d+/]{4})*(?:[A-Z\d+/]{2}==|[A-Z\d+/]{3}=)?$/i;

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

function base64ToBytes(value: string, label: string): Uint8Array<ArrayBuffer> {
  if (value.length === 0 || value.length % 4 !== 0 || !STANDARD_BASE64_PATTERN.test(value)) {
    throw new TypeError(`${label} must be standard padded base64`);
  }

  let binary: string;

  try {
    // eslint-disable-next-line unicorn/prefer-uint8array-base64 -- Browser support for Uint8Array.fromBase64 is still not universal.
    binary = atob(value);
  } catch {
    throw new TypeError(`${label} must be standard padded base64`);
  }

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index)!;
  }

  return bytes;
}

function joinBytes(prefix: Uint8Array, suffix: Uint8Array): Uint8Array<ArrayBuffer> {
  const joined = new Uint8Array(prefix.byteLength + suffix.byteLength);
  joined.set(prefix);
  joined.set(suffix, prefix.byteLength);
  return joined;
}

/**
 * An AES-GCM primitive: sealing yields the ciphertext with its 16-byte tag
 * appended, and opening verifies and strips that tag. Web Crypto answers
 * asynchronously and the portable cipher synchronously, so callers await both.
 */
interface AesGcmCipher {
  seal: (nonce: Uint8Array<ArrayBuffer>, plaintext: Uint8Array<ArrayBuffer>) => Awaitable<Uint8Array>;
  open: (nonce: Uint8Array<ArrayBuffer>, sealed: Uint8Array<ArrayBuffer>) => Awaitable<Uint8Array>;
}

/**
 * Native Web Crypto AES-GCM — hardware-accelerated and off the main thread, but
 * exposed by browsers only in secure contexts (HTTPS, localhost).
 */
function createWebCryptoCipher(subtle: SubtleCrypto, keyBytes: Uint8Array<ArrayBuffer>): AesGcmCipher {
  let key: Promise<CryptoKey> | undefined;

  function getKey(): Promise<CryptoKey> {
    key ??= subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
    return key;
  }

  return {
    seal: async (iv, plaintext) => new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, await getKey(), plaintext)),
    open: async (iv, sealed) => new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv }, await getKey(), sealed))
  };
}

/**
 * Pure-JavaScript AES-GCM for insecure contexts (plain HTTP), where browsers
 * hide `crypto.subtle`. It produces byte-for-byte the same output as Web Crypto.
 */
function createPortableCipher(keyBytes: Uint8Array<ArrayBuffer>): AesGcmCipher {
  return {
    seal: (nonce, plaintext) => gcm(keyBytes, nonce).encrypt(plaintext),
    open: (nonce, sealed) => gcm(keyBytes, nonce).decrypt(sealed)
  };
}

/**
 * Codec matching the Go framework's AES-GCM wire layout, running on Web Crypto
 * where the runtime exposes it and on a portable implementation elsewhere, so
 * protected bodies work over plain HTTP as well as HTTPS.
 */
export class ProtectedBodyCodec {
  readonly #cipher: AesGcmCipher;
  readonly encoding: ProtectedBodyEncodingOptions["encoding"];

  constructor(options: ProtectedBodyEncodingOptions) {
    if (options.encoding !== "aes-gcm+base64") {
      throw new TypeError(`Unsupported protected body encoding: ${String(options.encoding)}`);
    }

    const key = base64ToBytes(options.key, "Protected body key");

    if (key.byteLength !== 16 && key.byteLength !== 24 && key.byteLength !== 32) {
      throw new TypeError("Protected body AES-GCM key must contain 16, 24, or 32 bytes");
    }

    const subtle = globalThis.crypto?.subtle;

    this.encoding = options.encoding;
    this.#cipher = subtle ? createWebCryptoCipher(subtle, key) : createPortableCipher(key);
  }

  async encode(payload: string): Promise<string> {
    // Unlike `crypto.subtle`, `getRandomValues` is available in insecure contexts too.
    const nonce = crypto.getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
    const sealed = await this.#cipher.seal(nonce, new TextEncoder().encode(payload));

    return bytesToBase64(joinBytes(nonce, sealed));
  }

  async decode(payload: string): Promise<string> {
    const protectedBytes = base64ToBytes(payload.trim(), "Protected body");

    if (protectedBytes.byteLength < AES_GCM_NONCE_BYTES + AES_GCM_TAG_BYTES) {
      throw new TypeError("Protected body is too short");
    }

    const nonce = protectedBytes.slice(0, AES_GCM_NONCE_BYTES);
    const sealed = protectedBytes.slice(AES_GCM_NONCE_BYTES);
    const plaintext = await this.#cipher.open(nonce, sealed);

    return new TextDecoder("utf-8", { fatal: true }).decode(plaintext);
  }
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
