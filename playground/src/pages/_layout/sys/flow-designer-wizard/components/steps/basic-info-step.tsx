import type { EditorPlugins } from "@vef-framework-react/approval-flow-editor";
import type { CSSProperties, FC, ReactNode } from "react";

import type { BindingMode, FlowBasicInfo, FlowInitiator } from "../../types";

import { Card, Divider, Input, Segmented, Switch } from "@vef-framework-react/components";

import { InitiatorsEditor } from "../initiators-editor";
import { StepHeader } from "../step-header";

const BINDING_OPTIONS: Array<{ label: string; value: BindingMode }> = [
  { label: "独立存储", value: "standalone" },
  { label: "绑定业务表", value: "business" }
];

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
                  placeholder="business_table"
                  value={basic.businessTable ?? ""}
                  onChange={event => onBasicChange({ businessTable: event.target.value || undefined })}
                />
              </Field>
            )}

            {isBusiness && (
              <Field required label="主键字段">
                <Input
                  placeholder="business_pk_field"
                  value={basic.businessPkField ?? ""}
                  onChange={event => onBasicChange({ businessPkField: event.target.value || undefined })}
                />
              </Field>
            )}

            {isBusiness && (
              <Field label="标题字段">
                <Input
                  placeholder="business_title_field(可选)"
                  value={basic.businessTitleField ?? ""}
                  onChange={event => onBasicChange({ businessTitleField: event.target.value || undefined })}
                />
              </Field>
            )}

            {isBusiness && (
              <Field label="状态字段">
                <Input
                  placeholder="business_status_field(可选)"
                  value={basic.businessStatusField ?? ""}
                  onChange={event => onBasicChange({ businessStatusField: event.target.value || undefined })}
                />
              </Field>
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
