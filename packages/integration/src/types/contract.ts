import type { FullAudited } from "./base";
import type { JsonObject } from "./json";

/**
 * A self-contained JSON Schema (draft 2020-12) document.
 */
export type JsonSchema = JsonObject;

/**
 * A standard integration operation: the input and output models every
 * provider adapter must honor. Mirrors the Go `integration.Contract`.
 */
export interface Contract extends FullAudited {
  code: string;
  name: string;
  description?: string | null;
  inputSchema?: JsonSchema | null;
  outputSchema?: JsonSchema | null;
  isEnabled: boolean;
}

/**
 * Create/update parameters for a contract; `id` is empty on create.
 */
export interface ContractParams {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  inputSchema?: JsonSchema | null;
  outputSchema?: JsonSchema | null;
  isEnabled: boolean;
}

/**
 * Search parameters for contracts.
 */
export interface ContractSearch {
  code?: string;
  name?: string;
  isEnabled?: boolean;
}
