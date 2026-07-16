import type { CrudBasicSceneFormValues } from "@vef-framework-react/components";

import type { Adapter, AdapterParams, AdapterSearch } from "../../types";

import { createCrudKit } from "@vef-framework-react/components";

/**
 * Create and update share the adapter params shape.
 */
export type AdapterSceneValues = CrudBasicSceneFormValues<AdapterParams, AdapterParams>;

export const { OperationButtonGroup: AdapterOperationButtonGroup, ActionButtonGroup: AdapterActionButtonGroup }
  = createCrudKit<Adapter, AdapterSearch, AdapterSceneValues>();

/**
 * Project a saved adapter into its writable params, dropping the audit fields
 * the edit form must not submit back.
 */
export function adapterToParams(row: Adapter): AdapterParams {
  return {
    id: row.id,
    systemId: row.systemId,
    contractId: row.contractId,
    direction: row.direction,
    script: row.script,
    timeoutMs: row.timeoutMs,
    isEnabled: row.isEnabled
  };
}

const DEFAULT_SCRIPT = "// 出站：把 input 译成对外部系统的调用并返回契约输出\n// 入站：用 dispatch(input) 交给业务处理器\nreturn input;\n";

/**
 * Defaults for a newly created adapter.
 */
export const ADAPTER_FORM_DEFAULTS: AdapterParams = {
  systemId: "",
  contractId: "",
  direction: "outbound",
  script: DEFAULT_SCRIPT,
  timeoutMs: 0,
  isEnabled: true
};
