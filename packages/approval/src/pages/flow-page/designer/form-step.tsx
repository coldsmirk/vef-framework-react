import type { DeviceRegistries, FormSchema } from "@vef-framework-react/form-editor";

import type { StorageMode } from "../../../types";

import { validateApprovalProjection } from "@vef-framework-react/approval-form-bridge";
import { Flex, globalCssVars, Segmented, Stack, Text } from "@vef-framework-react/components";
import { FormEditor } from "@vef-framework-react/form-editor";
import { useMemo } from "react";

import { useApprovalPlugins } from "../../../plugins";
import { toFormContextSources } from "../../../plugins/form-context";

const STORAGE_OPTIONS: Array<{ label: string; value: StorageMode }> = [
  { label: "JSON 存储", value: "json" },
  { label: "独立表存储", value: "table" }
];

function isStorageMode(value: unknown): value is StorageMode {
  return value === "json" || value === "table";
}

const STORAGE_HINTS: Record<StorageMode, string> = {
  json: "表单数据以 JSONB 存入实例表，字段可灵活增减，查询能力有限。",
  table: "表单数据投影到按版本生成的独立表（明细表各自成表），适合复杂查询与数据分析。"
};

export interface FormStepProps {
  storageMode: StorageMode;
  /**
   * Seed for redesigning an existing flow; honored on the editor's first
   * mount only.
   */
  initialSchema?: FormSchema;
  /**
   * The approval-profile registries, owned by the designer so the editor and
   * the save gate share one instance.
   */
  registries: DeviceRegistries;
  onStorageModeChange: (mode: StorageMode) => void;
  onSchemaChange: (schema: FormSchema) => void;
}

/**
 * Step 2 — design the form. The rich schema deploys verbatim
 * (`DeployFlowCmd.FormSchema`); the backend derives the flat field list at
 * deploy, and the storage mode decides how that model persists.
 *
 * Every diagnostic — the editor's structural ones and the approval contract's
 * (the bridge projection, a client-side pre-check of the server parser) —
 * lives in the editor's own status bar, where each one jumps to its field, so
 * the canvas keeps its full height; the wizard's footer only says why the step
 * cannot advance. The applicant attributes and the host's form globals are
 * offered as system variables.
 */
export function FormStep({
  storageMode,
  initialSchema,
  registries,
  onStorageModeChange,
  onSchemaChange
}: FormStepProps) {
  const {
    dataSourceApis,
    dataSourceResolver,
    evaluators,
    formGlobals
  } = useApprovalPlugins();
  const contextSources = useMemo(() => toFormContextSources(formGlobals), [formGlobals]);

  return (
    <Stack gap={8} style={{ height: "100%", minHeight: 0 }}>
      <Flex align="center" gap="middle" wrap="wrap">
        <Text type="secondary">存储模式</Text>

        <Segmented
          options={STORAGE_OPTIONS}
          value={storageMode}
          onChange={next => {
            if (isStorageMode(next)) {
              onStorageModeChange(next);
            }
          }}
        />

        <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
          {STORAGE_HINTS[storageMode]}
        </Text>
      </Flex>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: `1px solid ${globalCssVars.colorBorderSecondary}`,
          borderRadius: 8,
          overflow: "hidden"
        }}
      >
        <FormEditor
          contextSources={contextSources}
          dataSourceApis={dataSourceApis}
          dataSourceResolver={dataSourceResolver}
          evaluators={evaluators}
          initialSchema={initialSchema}
          registries={registries}
          validate={validateApprovalProjection}
          onSchemaChange={onSchemaChange}
        />
      </div>
    </Stack>
  );
}
