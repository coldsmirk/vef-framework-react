import type { EditorPlugins } from "@vef-framework-react/approval-flow-editor";
import type { CSSProperties, FC, ReactNode } from "react";

import type { BindingMode, BusinessBindingConfig, FlowBasicInfo, FlowInitiator, ProjectableInstanceStatus } from "../../types";

import { Card, Divider, Input, Segmented, Select, Switch } from "@vef-framework-react/components";

import { InitiatorsEditor } from "../initiators-editor";
import { StepHeader } from "../step-header";

const BINDING_OPTIONS: Array<{ label: string; value: BindingMode }> = [
  { label: "独立存储", value: "standalone" },
  { label: "绑定业务表", value: "business" }
];

const STATUS_MAPPING_OPTIONS: Array<{ status: ProjectableInstanceStatus; label: string }> = [
  { status: "running", label: "审批中" },
  { status: "approved", label: "已通过" },
  { status: "rejected", label: "已拒绝" },
  { status: "withdrawn", label: "已撤回" },
  { status: "returned", label: "已退回" },
  { status: "terminated", label: "已终止" }
];

const EMPTY_BINDING: BusinessBindingConfig = {
  tableName: "",
  keyColumns: [],
  statusColumn: "",
  instanceIdColumn: ""
};

function isBindingMode(value: unknown): value is BindingMode {
  return value === "standalone" || value === "business";
}

const containerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1680,
  margin: "0 auto",
  background: "radial-gradient(1100px 280px at 0 -60px, color-mix(in srgb, var(--vef-color-primary) 6%, transparent), transparent 72%)"
};

const columnsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "stretch",
  gap: 20
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  columnGap: 28,
  rowGap: 18
};

const fullSpan: CSSProperties = { gridColumn: "1 / -1" };

const sectionLabelStyle: CSSProperties = {
  marginBottom: 12,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--vef-color-text-secondary)"
};

const Field: FC<{ label: string; required?: boolean; children: ReactNode }> = ({
  label,
  required,
  children
}) => (
  <div style={{
    display: "flex",
    alignItems: "flex-start",
    gap: 12
  }}
  >
    <div style={{
      width: 104,
      flexShrink: 0,
      paddingTop: 6,
      fontSize: 13,
      lineHeight: "20px",
      textAlign: "right",
      color: "var(--vef-color-text-secondary)"
    }}
    >
      {required && <span style={{ color: "var(--vef-color-error)", marginRight: 2 }}>*</span>}
      {label}
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

interface BasicInfoStepProps {
  basic: FlowBasicInfo;
  initiators: FlowInitiator[];
  pickers?: EditorPlugins["pickers"];
  onBasicChange: (patch: Partial<FlowBasicInfo>) => void;
  onInitiatorsChange: (value: FlowInitiator[]) => void;
}

/**
 * Step 1 — flow basic info (the `Flow` record) plus the flow-scoped initiators,
 * laid out full-width as two side-by-side sections: the flow identity / storage
 * on the left and the initiation scope (admins, open-flag, initiators) on the
 * right.
 */
export const BasicInfoStep: FC<BasicInfoStepProps> = ({
  basic,
  initiators,
  pickers,
  onBasicChange,
  onInitiatorsChange
}) => {
  const AdminPicker = pickers?.user;
  const isBusiness = basic.bindingMode === "business";
  const binding = basic.businessBinding ?? EMPTY_BINDING;

  const patchBinding = (patch: Partial<BusinessBindingConfig>) => {
    onBasicChange({ businessBinding: { ...binding, ...patch } });
  };

  const patchStatusMapping = (status: ProjectableInstanceStatus, value: string) => {
    const mapping = { ...binding.statusMapping };

    if (value.trim() === "") {
      delete mapping[status];
    } else {
      mapping[status] = value;
    }

    patchBinding({ statusMapping: Object.keys(mapping).length > 0 ? mapping : undefined });
  };

  return (
    <div style={containerStyle}>
      <StepHeader
        description="定义流程的身份、表单存储方式与可发起范围 —— 对应后端 Flow 记录"
        index={1}
        title="基本信息"
      />

      <div style={columnsStyle}>
        <Card style={{ flex: "1.7 1 560px", minWidth: 0 }} title="流程信息">
          <div style={gridStyle}>
            <Field required label="流程编码">
              <Input
                placeholder="唯一编码,如 leave_request"
                value={basic.code}
                onChange={event => onBasicChange({ code: event.target.value })}
              />
            </Field>

            <Field required label="流程名称">
              <Input
                placeholder="如 请假申请"
                value={basic.name}
                onChange={event => onBasicChange({ name: event.target.value })}
              />
            </Field>

            <Field label="分类 ID">
              <Input
                placeholder="categoryId(可选)"
                value={basic.categoryId ?? ""}
                onChange={event => onBasicChange({ categoryId: event.target.value || undefined })}
              />
            </Field>

            <Field required label="实例标题模板">
              <Input
                placeholder="如 {applicant} 的请假申请"
                value={basic.instanceTitleTemplate}
                onChange={event => onBasicChange({ instanceTitleTemplate: event.target.value })}
              />
            </Field>

            <div style={fullSpan}>
              <Field label="描述">
                <Input.TextArea
                  placeholder="流程说明(可选)"
                  rows={2}
                  value={basic.description ?? ""}
                  onChange={event => onBasicChange({ description: event.target.value || undefined })}
                />
              </Field>
            </div>

            <div style={fullSpan}>
              <Field label="绑定模式">
                <Segmented
                  options={BINDING_OPTIONS}
                  value={basic.bindingMode}
                  onChange={next => {
                    if (isBindingMode(next)) {
                      onBasicChange({ bindingMode: next });
                    }
                  }}
                />
              </Field>
            </div>

            {isBusiness && (
              <Field required label="业务表名">
                <Input
                  placeholder="table_name"
                  value={binding.tableName}
                  onChange={event => patchBinding({ tableName: event.target.value })}
                />
              </Field>
            )}

            {isBusiness && (
              <Field required label="主键列">
                <Select
                  mode="tags"
                  open={false}
                  placeholder="key_columns(回车添加,须与表上的非空主键/唯一键完全一致)"
                  style={{ width: "100%" }}
                  suffixIcon={null}
                  tokenSeparators={[",", " "]}
                  value={binding.keyColumns}
                  onChange={(columns: string[]) => patchBinding({ keyColumns: columns })}
                />
              </Field>
            )}

            {isBusiness && (
              <Field required label="状态列">
                <Input
                  placeholder="status_column"
                  value={binding.statusColumn}
                  onChange={event => patchBinding({ statusColumn: event.target.value })}
                />
              </Field>
            )}

            {isBusiness && (
              <Field required label="实例 ID 列">
                <Input
                  placeholder="instance_id_column(引擎以此做防覆盖栅栏)"
                  value={binding.instanceIdColumn}
                  onChange={event => patchBinding({ instanceIdColumn: event.target.value })}
                />
              </Field>
            )}

            {isBusiness && (
              <Field label="开始时间列">
                <Input
                  placeholder="started_at_column(可选)"
                  value={binding.startedAtColumn ?? ""}
                  onChange={event => patchBinding({ startedAtColumn: event.target.value || undefined })}
                />
              </Field>
            )}

            {isBusiness && (
              <Field label="结束时间列">
                <Input
                  placeholder="finished_at_column(可选)"
                  value={binding.finishedAtColumn ?? ""}
                  onChange={event => patchBinding({ finishedAtColumn: event.target.value || undefined })}
                />
              </Field>
            )}

            {isBusiness && (
              <div style={fullSpan}>
                <Field label="状态映射">
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8
                  }}
                  >
                    {STATUS_MAPPING_OPTIONS.map(({ status, label }) => (
                      <div
                        key={status}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <span style={{
                          flexShrink: 0,
                          fontSize: 12,
                          color: "var(--vef-color-text-secondary)"
                        }}
                        >
                          {label}
                        </span>

                        <Input
                          placeholder={status}
                          value={binding.statusMapping?.[status] ?? ""}
                          onChange={event => patchStatusMapping(status, event.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "var(--vef-color-text-tertiary)"
                  }}
                  >
                    审批状态写回状态列时的取值,留空则回写状态原值
                  </div>
                </Field>
              </div>
            )}
          </div>
        </Card>

        <Card style={{ flex: "1 1 360px", minWidth: 0 }} title="发起范围">
          <Field label="管理员">
            {AdminPicker
              ? <AdminPicker value={basic.adminUserIds} onChange={ids => onBasicChange({ adminUserIds: ids })} />
              : <span style={{ color: "var(--vef-color-text-tertiary)" }}>未提供用户选择器</span>}
          </Field>

          <div style={{ height: 16 }} />

          <Field label="允许所有人发起">
            <Switch
              checked={basic.isAllInitiationAllowed}
              onChange={checked => onBasicChange({ isAllInitiationAllowed: checked })}
            />
          </Field>

          <Divider style={{ margin: "20px 0 16px" }} />
          <div style={sectionLabelStyle}>发起人(谁可以发起此流程)</div>
          <InitiatorsEditor pickers={pickers} value={initiators} onChange={onInitiatorsChange} />
        </Card>
      </div>
    </div>
  );
};
