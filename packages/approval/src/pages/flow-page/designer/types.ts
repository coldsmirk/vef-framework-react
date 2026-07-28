import type { FlowDefinition } from "@vef-framework-react/approval-flow-editor";
import type { FormSchema } from "@vef-framework-react/form-editor";

import type { BindingMode, BusinessBindingConfig, InitiatorParams, StorageMode } from "../../../types";

/**
 * The flow-settings half of the designer draft — everything
 * `approval/flow.create` / `update` consumes.
 */
export interface FlowDraftBasic {
  tenantId: string;
  code: string;
  name: string;
  categoryId: string;
  icon?: string;
  description?: string;
  labels: Record<string, string>;
  bindingMode: BindingMode;
  businessBinding?: BusinessBindingConfig;
  adminUserIds: string[];
  isAllInitiationAllowed: boolean;
  instanceTitleTemplate: string;
}

/**
 * The complete designer draft: flow settings plus the deployable definition.
 * The wizard assembles it across steps and the submit chain turns it into
 * `create`/`update` → `deploy` → optional `publish_version`.
 */
export interface FlowDraft {
  /**
   * Present when redesigning an existing flow.
   */
  flowId?: string;
  basic: FlowDraftBasic;
  initiators: InitiatorParams[];
  storageMode: StorageMode;
  formSchema: FormSchema | null;
  flowDefinition: FlowDefinition;
}

export const EMPTY_FLOW_DEFINITION: FlowDefinition = { nodes: [], edges: [] };

export function createEmptyDraft(tenantId: string): FlowDraft {
  return {
    basic: {
      tenantId,
      code: "",
      name: "",
      categoryId: "",
      labels: {},
      bindingMode: "standalone",
      adminUserIds: [],
      isAllInitiationAllowed: false,
      instanceTitleTemplate: ""
    },
    initiators: [],
    storageMode: "json",
    formSchema: null,
    flowDefinition: EMPTY_FLOW_DEFINITION
  };
}

/**
 * Mirrors the backend's business-identifier whitelist
 * (`approval.ValidateBusinessIdentifier`): table / column names must be plain
 * SQL identifiers.
 */
export const BUSINESS_IDENTIFIER_PATTERN = /^[A-Z_]\w{0,62}$/i;

/**
 * The initiator rules a draft should be saved with.
 *
 * A flow open to everyone carries none: the two settings are mutually exclusive
 * server-side, because initiation permission short-circuits on the flag and
 * never reads the rules — saved rules would show a restriction that does not
 * hold. The draft still keeps whatever was typed, so toggling the switch back
 * does not lose it; the rules are dropped only on the way out, the same way a
 * standalone flow drops its in-progress business binding.
 *
 * Rules with nothing selected are incomplete and never sent. Validation and
 * submit both read this, so what the wizard accepts is exactly what it saves.
 */
export function initiatorsForSubmit(draft: FlowDraft): InitiatorParams[] {
  if (draft.basic.isAllInitiationAllowed) {
    return [];
  }

  return draft.initiators.filter(rule => rule.ids.length > 0);
}

/**
 * Client-side pre-check of the backend binding save gate
 * (`binding.NormalizeConfig`): table, key columns, status column and
 * instance-id column are mandatory, every name must be a plain SQL
 * identifier, and status-mapping values must not be blank.
 */
export function isBindingValid(binding: BusinessBindingConfig | undefined): boolean {
  if (!binding) {
    return false;
  }

  const identifiers = [
    binding.tableName,
    ...binding.keyColumns,
    binding.statusColumn,
    ...binding.instanceIdColumn === undefined ? [] : [binding.instanceIdColumn],
    ...binding.startedAtColumn !== undefined && binding.startedAtColumn !== "" ? [binding.startedAtColumn] : [],
    ...binding.finishedAtColumn !== undefined && binding.finishedAtColumn !== "" ? [binding.finishedAtColumn] : []
  ];

  return binding.keyColumns.length > 0
    && binding.instanceIdColumn !== undefined
    && binding.instanceIdColumn !== ""
    && identifiers.every(identifier => BUSINESS_IDENTIFIER_PATTERN.test(identifier))
    && Object.values(binding.statusMapping ?? {}).every(value => value === undefined || value.trim() !== "");
}
