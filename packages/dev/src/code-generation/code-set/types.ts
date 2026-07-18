/**
 * Single dictionary key entry returned by the project-provided fetcher.
 */
export interface DictionaryKeyEntry {
  /**
   * Dictionary key string, e.g. `"sys.menu.type"`.
   * Must match `/^[\w.-]+$/` (letters, digits, underscore, dot, hyphen).
   */
  key: string;
  /**
   * Optional human-readable description rendered as a JSDoc comment.
   */
  comment?: string;
}

/**
 * Configuration block for dictionary key generation.
 */
export interface DictionaryKeysConfig {
  /**
   * Output path resolved against the project root. Must stay within
   * `projectDir`; absolute paths and `..` traversal are rejected at runtime.
   *
   * @default "src/types/dictionary.gen.ts"
   */
  output?: string;
  /**
   * Fetcher invoked at generation time to retrieve all dictionary keys.
   * Runs in Node, so use Node-side HTTP/DB clients with project credentials.
   */
  fetchDictionaryKeys: () => Promise<readonly DictionaryKeyEntry[]>;
  /**
   * Timeout (ms) for `fetchDictionaryKeys`. After this, generation aborts with
   * an error. Set to `0` to disable the timeout entirely.
   *
   * @default 30000
   */
  timeout?: number;
}

/**
 * Top-level code generation configuration container. Authored in
 * `code-generation.config.{ts,mts,js,mjs}` at the project root. Future generators
 * (i18n, apiSchema, etc.) live alongside `dictionaryKeys` so a project keeps
 * a single code generation entry point.
 */
export interface CodeGenerationConfig {
  /**
   * Dictionary keys generator. See {@link DictionaryKeysConfig}.
   */
  dictionaryKeys?: DictionaryKeysConfig;
}

/**
 * Identity helper for typed `code-generation.config.ts` authoring. Preserves
 * literal types via the generic parameter.
 */
export function defineCodeGenerationConfig<T extends CodeGenerationConfig>(config: T): T {
  return config;
}
