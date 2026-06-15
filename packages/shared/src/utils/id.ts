import { init } from "@paralleldrive/cuid2";
import { isNullish } from "radashi";

/**
 * Default fingerprint for vef-framework ID generation.
 */
const DEFAULT_FINGERPRINT = "0cd902ccad1f26c27b8db84af2282b7b";

/**
 * ID length for generated IDs.
 */
const ID_LENGTH = 16;

/**
 * Check if the current environment supports FingerprintJS.
 *
 * @returns true if FingerprintJS can be safely used
 */
function isFingerprintSupported(): boolean {
  return !isNullish(navigator) && !navigator.userAgent.includes("jsdom");
}

/**
 * Initialize ID generator with default fingerprint.
 */
let createId = init({
  length: ID_LENGTH,
  fingerprint: DEFAULT_FINGERPRINT
});

/**
 * Conditionally initialize FingerprintJS only if supported.
 */
if (isFingerprintSupported()) {
  import("@fingerprintjs/fingerprintjs")
    .then(({ load }) => load())
    .then(fp => fp.get())
    .then(result => {
      createId = init({
        length: ID_LENGTH,
        fingerprint: result.visitorId
      });
    })
    // eslint-disable-next-line unicorn/prefer-top-level-await
    .catch(error => {
      console.error("Failed to initialize fingerprint:", error);
    });
}

/**
 * Generates a unique ID based on browser fingerprint.
 *
 * @returns A unique ID string
 */
export function generateId(): string {
  return createId();
}
