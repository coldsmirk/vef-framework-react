/**
 * One code set the host catalog exposes. Mirrors the Go `mold.CodeSetInfo`.
 */
export interface CodeSetInfo {
  codeSet: string;
  name: string;
}

/**
 * One code within a host code set. Mirrors the Go `mold.CodeInfo`.
 */
export interface CodeInfo {
  code: string;
  label: string;
}

/**
 * The list_code_sets reply. `supported` is false when the host registered no
 * enumerable catalog — the mapping editor then falls back to free-text input.
 */
export interface CodeSetCatalog {
  supported: boolean;
  codeSets?: CodeSetInfo[];
}

/**
 * The list_codes reply for one code set.
 */
export interface CodeCatalog {
  supported: boolean;
  codes?: CodeInfo[];
}
