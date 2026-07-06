import type { ApprovalSchemaIssue } from "@vef-framework-react/approval-form-bridge";
import type { DeviceRegistries, FormSchema } from "@vef-framework-react/form-editor";
import type { FC } from "react";

import type { StorageMode } from "../../types";

import { Segmented } from "@vef-framework-react/components";
import { FormEditor } from "@vef-framework-react/form-editor";

const STORAGE_OPTIONS: Array<{ label: string; value: StorageMode }> = [
  { label: "JSON 存储", value: "json" },
  { label: "独立表存储", value: "table" }
];

function isStorageMode(value: unknown): value is StorageMode {
  return value === "json" || value === "table";
}

const STORAGE_HINT: Record<StorageMode, string> = {
  json: "表单数据以 JSONB 存入 apv_instance.form_data,字段可灵活增减,查询能力有限。",
  table: "表单数据存入独立表 apv_form_data_{code},字段即列,适合复杂查询。"
};

interface FormDesignStepProps {
  storageMode: StorageMode;
  /**
   * Save-gate diagnostics (structural + projection) for the current schema;
   * errors block the next step, warnings are informational.
   */
  issues: ApprovalSchemaIssue[];
  /**
   * The approval-profile registries, owned by the wizard so the editor and
   * the save gate share one instance (the prop is honored on first mount).
   */
  registries: DeviceRegistries;
  onStorageModeChange: (mode: StorageMode) => void;
  onSchemaChange: (schema: FormSchema) => void;
}

/**
 * Step 2 — design the form. The flat field list IS the data model; the storage
 * mode decides how the backend persists it. The editor runs under the approval
 * registry profile (no switch / daterange / button), and the wizard projects
 * the rich form-editor schema through the approval-form-bridge on change.
 */
export const FormDesignStep: FC<FormDesignStepProps> = ({
  storageMode,
  issues,
  registries,
  onStorageModeChange,
  onSchemaChange
}) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0
  }}
  >
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 4px 12px",
      flexWrap: "wrap"
    }}
    >
      <span style={{ color: "var(--vef-color-text-secondary)" }}>存储模式</span>

      <Segmented
        options={STORAGE_OPTIONS}
        value={storageMode}
        onChange={next => {
          if (isStorageMode(next)) {
            onStorageModeChange(next);
          }
        }}
      />

      <span style={{ fontSize: 12, color: "var(--vef-color-text-tertiary)" }}>{STORAGE_HINT[storageMode]}</span>
    </div>

    {issues.length > 0 && (
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "0 4px 12px",
        fontSize: 12
      }}
      >
        {issues.map((issue, index) => (
          <span
            key={`${issue.code}:${issue.path}:${index}`}
            style={{ color: issue.severity === "error" ? "var(--vef-color-error)" : "var(--vef-color-warning)" }}
          >
            {issue.message}
          </span>
        ))}
      </div>
    )}

    <div style={{
      flex: 1,
      minHeight: 0,
      border: "1px solid var(--vef-color-border-secondary)",
      borderRadius: 8,
      overflow: "hidden"
    }}
    >
      <FormEditor registries={registries} onSchemaChange={onSchemaChange} />
    </div>
  </div>
);
