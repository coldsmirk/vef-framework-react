import type { FormFieldRegistry } from "../../engine/registry/form-field-registry";
import type { Block, FieldDefinition, PresentationLayer } from "../../types";
import type { DropZoneAccept } from "./drop-zones";

import { isTableColumnField } from "../../engine/schema/subform";
import { findNode } from "../../engine/schema/walk";
import { isEditorDragData } from "../dnd";

/**
 * Column eligibility for the `table` subform variant: a column is a keyed leaf
 * field, so only those may be dropped into a table subform or rendered as a
 * column. Containers and non-keyed display / action blocks are excluded. This is
 * the design-time enforcement of the same contract `validateSchema` checks
 * post-hoc (`subform_table_column`) and the runtime table renderer honors by
 * skipping non-columns.
 */
export { isTableColumnField } from "../../engine/schema/subform";

/**
 * Whether a resolved node (or a `findNode` miss) is column-eligible. A missing
 * node is never a column.
 */
export function isColumnEligibleNode(node: Block | undefined): boolean {
  return node !== undefined && isTableColumnField(node);
}

/**
 * Whether a palette field type would create a column-eligible field. A leaf field
 * registers a `Component`; `config.keyed` excludes non-keyed leaves (button /
 * divider / tip / paragraph). A container — including the keyed subform — has no
 * `Component`, so it is excluded too.
 */
export function isColumnEligibleDefinition(definition: FieldDefinition | undefined): boolean {
  return definition?.Component !== undefined && definition.config.keyed === true;
}

/**
 * The drop-zone `accept` predicate for a table subform's zones: take a dragged
 * source only when it would become a valid column — a new keyed leaf field from
 * the palette, or an existing keyed leaf block being moved. Rejecting at the drop
 * affordance keeps a container / display block from ever landing as a column,
 * rather than accepting it and surfacing a validation warning after the fact.
 */
export function makeColumnAccept(registry: FormFieldRegistry, layer: PresentationLayer | undefined): DropZoneAccept {
  return source => {
    const { data } = source;

    if (!isEditorDragData(data)) {
      return false;
    }

    if (data.kind === "palette") {
      return isColumnEligibleDefinition(registry.getPaletteItem(data.paletteKey));
    }

    return layer !== undefined && isColumnEligibleNode(findNode(layer, data.nodeId));
  };
}
