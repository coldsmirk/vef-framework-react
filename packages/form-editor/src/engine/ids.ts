import type { ContainerNode } from "../types";

import { generateId } from "@vef-framework-react/shared";

export type IdPrefix
  = | "Action"
    | "Condition"
    | "DataSource"
    | "Field"
    | "Flex"
    | "Grid"
    | "Form"
    | "Rule"
    | "Section"
    | "Tabs"
    | "Tab"
    | "Subform"
    | "Var";

/**
 * Generate a prefixed unique id, e.g. createId("Field") → "Field_xxxxxxxxxxxxxxxx".
 * Reuses the shared cuid2-based generator.
 */
export function createId(prefix: IdPrefix): string {
  return `${prefix}_${generateId()}`;
}

/**
 * Per-container id prefixes, typed as a complete record over
 * `ContainerNode["type"]` so adding a container variant forces an entry here
 * (or the file fails to compile) — the same single-source pattern as
 * `CONTAINER_TYPE_TABLE` in `types/schema.ts`.
 */
const CONTAINER_ID_PREFIXES: Record<ContainerNode["type"], IdPrefix> = {
  section: "Section",
  tabs: "Tabs",
  subform: "Subform",
  flex: "Flex",
  grid: "Grid"
};

const CONTAINER_ID_PREFIX_BY_TYPE = new Map<string, IdPrefix>(Object.entries(CONTAINER_ID_PREFIXES));

/**
 * The id prefix a node of the given `type` is minted with: the per-container
 * prefix for the closed container set, `"Field"` for every leaf field type.
 * The single authority shared by block creation and the clone/move rebuild in
 * `schema/edit-ops.ts`, so a node's id prefix never depends on which path
 * created it.
 */
export function idPrefixForType(type: string): IdPrefix {
  return CONTAINER_ID_PREFIX_BY_TYPE.get(type) ?? "Field";
}
