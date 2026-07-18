import type { FullAudited } from "./base";
import type { UnmappedPolicy } from "./enums";

/**
 * The JSON scalar a code map value may hold. Values keep their JSON type end
 * to end (the server stores and emits them verbatim); lookups compare by
 * normalized string form, so 1 and "1" address the same entry.
 */
export type CodeValue = string | number | boolean;

/**
 * One bidirectional mapping pair between the canonical model and one external
 * system's coding. Each side carries one primary value and any number of
 * aliases: lookups match the primary or any alias, translations always emit
 * the opposite side's primary. Mirrors the Go `integration.CodeMapEntry`.
 */
export interface CodeMapEntry {
  canonical: CodeValue;
  external: CodeValue;
  canonicalAliases?: CodeValue[];
  externalAliases?: CodeValue[];
}

/**
 * The value translation of one code set between the host's canonical codes
 * and one external system's codes. Mirrors the Go `integration.CodeMap`.
 */
export interface CodeMap extends FullAudited {
  systemId: string;
  codeSet: string;
  name: string;
  entries?: CodeMapEntry[];
  onUnmapped: UnmappedPolicy;
  fallbackCanonical?: CodeValue;
  fallbackExternal?: CodeValue;
  isEnabled: boolean;
}

/**
 * Create/update parameters for a code map; an omitted policy is reject.
 */
export interface CodeMapParams {
  id?: string;
  systemId: string;
  codeSet: string;
  name: string;
  entries?: CodeMapEntry[];
  onUnmapped?: UnmappedPolicy;
  fallbackCanonical?: CodeValue;
  fallbackExternal?: CodeValue;
  isEnabled: boolean;
}

/**
 * Search parameters for code maps.
 */
export interface CodeMapSearch {
  systemId?: string;
  codeSet?: string;
  name?: string;
  isEnabled?: boolean;
}
