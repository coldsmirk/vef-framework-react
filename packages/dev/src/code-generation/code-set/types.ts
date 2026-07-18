/**
 * Single code set key entry returned by the project-provided fetcher.
 */
export interface CodeSetKeyEntry {
  /**
   * CodeSet key string, e.g. `"sys.menu.type"`.
   * Must match `/^[\w.-]+$/` (letters, digits, underscore, dot, hyphen).
   */
  key: string;
  /**
   * Optional human-readable description rendered as a JSDoc comment.
   */
  comment?: string;
}

/**
 * Configuration block for code set key generation.
 */
export interface CodeSetKeysConfig {
  /**
   * Output path resolved against the project root. Must stay within
   * `projectDir`; absolute paths and `..` traversal are rejected at runtime.
   *
   * @default "src/types/code-set-keys.gen.ts"
   */
  output?: string;
  /**
   * Fetcher invoked at generation time to retrieve all code set keys.
   * Runs in Node, so use Node-side HTTP/DB clients with project credentials.
   */
  fetchCodeSetKeys: () => Promise<readonly CodeSetKeyEntry[]>;
  /**
   * Timeout (ms) for `fetchCodeSetKeys`. After this, generation aborts with
   * an error. Set to `0` to disable the timeout entirely.
   *
   * @default 30000
   */
  timeout?: number;
}

/**
 * Top-level code generation configuration container. Authored in
 * `code-generation.config.{ts,mts,js,mjs}` at the project root. Future generators
 * (i18n, apiSchema, etc.) live alongside `codeSetKeys` so a project keeps
 * a single code generation entry point.
 */
export interface CodeGenerationConfig {
  /**
   * CodeSet keys generator. See {@link CodeSetKeysConfig}.
   */
  codeSetKeys?: CodeSetKeysConfig;
}

/**
 * Identity helper for typed `code-generation.config.ts` authoring. Preserves
 * literal types via the generic parameter.
 */
export function defineCodeGenerationConfig<T extends CodeGenerationConfig>(config: T): T {
  return config;
}
