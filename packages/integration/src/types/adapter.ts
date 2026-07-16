import type { FullAudited } from "./base";
import type { Direction } from "./enums";

/**
 * One system-to-contract binding in one flow direction: a script translating
 * between the system's wire format and the contract's standard models.
 * Mirrors the Go `integration.Adapter`.
 */
export interface Adapter extends FullAudited {
  systemId: string;
  contractId: string;
  direction: Direction;
  script: string;
  timeoutMs?: number;
  isEnabled: boolean;
}

/**
 * Create/update parameters for an adapter; an omitted direction is outbound.
 */
export interface AdapterParams {
  id?: string;
  systemId: string;
  contractId: string;
  direction?: Direction;
  script: string;
  timeoutMs?: number;
  isEnabled: boolean;
}

/**
 * Search parameters for adapters.
 */
export interface AdapterSearch {
  systemId?: string;
  contractId?: string;
  direction?: Direction;
  isEnabled?: boolean;
}
