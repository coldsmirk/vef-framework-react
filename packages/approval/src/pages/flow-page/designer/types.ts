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
