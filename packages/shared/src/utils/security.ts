import JSEncrypt from "jsencrypt";

import { isNullish } from "./lib";

/**
 * XOR key for string obfuscation (16 bytes).
 */
const XOR_KEY = new Uint8Array([
  0x5A,
  0x4B,
  0x3C,
  0x2D,
  0x1E,
  0x0F,
  0x9A,
  0x8B,
  0x7C,
  0x6D,
  0x5E,
  0x4F,
  0x3A,
  0x2B,
  0x1C,
  0x0D
]);

/**
 * Encode a string to XOR-encrypted byte array.
 *
 * @param plainText The plain text string to encode
 * @returns The encrypted byte array
 */
export function obfuscateEncode(plainText: string): Uint8Array {
  if (!plainText) {
    return new Uint8Array(0);
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(plainText);
  const encoded = new Uint8Array(bytes.length);

  for (const [i, byte] of bytes.entries()) {
    encoded[i] = byte ^ XOR_KEY[i % XOR_KEY.length]!;
  }

  return encoded;
}

/**
 * Decode an XOR-encrypted byte array to string.
 *
 * @param encoded The encrypted byte array
 * @returns The decoded string
 */
export function obfuscateDecode(encoded: Uint8Array | number[]): string {
  if (!encoded?.length) {
    return "";
  }

  const bytes = encoded instanceof Uint8Array ? encoded : new Uint8Array(encoded);
  const decoded = new Uint8Array(bytes.length);

  for (const [i, byte] of bytes.entries()) {
    decoded[i] = byte ^ XOR_KEY[i % XOR_KEY.length]!;
  }

  const decoder = new TextDecoder("utf-8");
  return decoder.decode(decoded);
}

/**
 * Encode a string to XOR-encrypted hex string.
 *
 * @param plainText The plain text string to encode
 * @returns The encrypted hex string
 */
export function obfuscateEncodeToHex(plainText: string): string {
  const encoded = obfuscateEncode(plainText);
  return [...encoded]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Decode an XOR-encrypted hex string to plain text.
 *
 * @param hexString The encrypted hex string
 * @returns The decoded string
 */
export function obfuscateDecodeFromHex(hexString: string): string {
  if (!hexString) {
    return "";
  }

  const bytes = new Uint8Array(hexString.length / 2);

  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hexString.slice(i, i + 2), 16);
  }

  return obfuscateDecode(bytes);
}

/**
 * Encode a string to XOR-encrypted base64 string.
 *
 * @param plainText The plain text string to encode
 * @returns The encrypted base64 string
 */
export function obfuscateEncodeToBase64(plainText: string): string {
  const encoded = obfuscateEncode(plainText);

  if (encoded.length === 0) {
    return "";
  }

  const binaryString = String.fromCodePoint(...encoded);
  return btoa(binaryString);
}

/**
 * Decode an XOR-encrypted base64 string to plain text.
 *
 * @param base64String The encrypted base64 string
 * @returns The decoded string
 */
export function obfuscateDecodeFromBase64(base64String: string): string {
  if (!base64String) {
    return "";
  }

  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.codePointAt(i)!;
  }

  return obfuscateDecode(bytes);
}

/**
 * Encrypts a given value using RSA encryption with the given public key.
 *
 * @param value The value to encrypt
 * @param publicKey The public key to use for encryption
 * @returns The encrypted value
 * @throws If the encryption fails or inputs are invalid
 */
export function encryptUsingRSA(value: string, publicKey: string): string {
  if (isNullish(value) || !publicKey?.trim()) {
    throw new Error("Failed to encrypt data using RSA: invalid input");
  }

  const rsa = new JSEncrypt();
  rsa.setPublicKey(publicKey);
  const encrypted = rsa.encrypt(value);

  if (!encrypted) {
    console.error("Failed to encrypt data using RSA");
    throw new Error("Failed to encrypt data using RSA");
  }

  return encrypted;
}

/**
 * Decrypts a given value using RSA encryption with the given private key.
 *
 * @param value The value to decrypt
 * @param privateKey The private key to use for decryption
 * @returns The decrypted value
 * @throws If the decryption fails or inputs are invalid
 */
export function decryptUsingRSA(value: string, privateKey: string): string {
  if (isNullish(value) || !privateKey?.trim()) {
    throw new Error("Failed to decrypt data using RSA: invalid input");
  }

  const rsa = new JSEncrypt();
  rsa.setPrivateKey(privateKey);
  const decrypted = rsa.decrypt(value);

  if (!decrypted) {
    console.error("Failed to decrypt data using RSA");
    throw new Error("Failed to decrypt data using RSA");
  }

  return decrypted;
}
