import type { ApprovalSchemaIssue } from "@vef-framework-react/approval-form-bridge";
import type { DeviceRegistries, FormSchema } from "@vef-framework-react/form-editor";

import type { StorageMode } from "../../../types";

import { Alert, Flex, globalCssVars, Segmented, Stack, Text } from "@vef-framework-react/components";
import { FormEditor } from "@vef-framework-react/form-editor";

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
   * Save-gate diagnostics (structural + projection) for the current schema;
   * errors block the next step, warnings are informational.
   */
  issues: ApprovalSchemaIssue[];
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
 * deploy, and the storage mode decides how that model persists. The
 * approval-form-bridge projection runs on change as a client-side pre-check
 * of the server parser.
 */
export function FormStep({
  storageMode,
  initialSchema,
  issues,
  registries,
  onStorageModeChange,
  onSchemaChange
}: FormStepProps) {
  const errors = issues.filter(issue => issue.severity === "error");
  const warnings = issues.filter(issue => issue.severity !== "error");

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

      {errors.length > 0 && (
        <Alert
          showIcon
          title={`表单校验未通过（${errors.length} 项）`}
          type="error"
          description={(
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {/* Issues have no identity beyond code+path occurrence. */}
              {errors.map((issue, index) => <li key={index}>{issue.message}</li>)}
            </ul>
          )}
        />
      )}

      {errors.length === 0 && warnings.length > 0
        && <Alert showIcon title={warnings.map(issue => issue.message).join("；")} type="warning" />}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: `1px solid ${globalCssVars.colorBorderSecondary}`,
          borderRadius: 8,
          overflow: "hidden"
        }}
      >
        <FormEditor initialSchema={initialSchema} registries={registries} onSchemaChange={onSchemaChange} />
      </div>
    </Stack>
  );
}
