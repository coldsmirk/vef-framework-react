import type { CSSProperties, FC } from "react";

import type { FlowDesignPayload } from "../../types";

import { Card, Descriptions, Empty, Tag } from "@vef-framework-react/components";

import { StepHeader } from "../step-header";

const STORAGE_LABEL: Record<FlowDesignPayload["storageMode"], string> = {
  json: "JSON 存储",
  table: "独立表存储"
};

const containerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1680,
  margin: "0 auto",
  background: "radial-gradient(1100px 280px at 0 -60px, color-mix(in srgb, var(--vef-color-primary) 6%, transparent), transparent 72%)"
};

const columnsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: 20
};

const monoStyle: CSSProperties = {
  padding: "1px 6px",
  borderRadius: 5,
  background: "var(--vef-color-fill-tertiary)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 12.5
};

const codeStyle: CSSProperties = {
  margin: 0,
  padding: "14px 16px",
  minHeight: 360,
  maxHeight: "calc(100vh - 300px)",
  overflow: "auto",
  background: "var(--vef-color-fill-quaternary)",
  border: "1px solid var(--vef-color-border-secondary)",
  borderRadius: 8,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "var(--vef-color-text-secondary)"
};

interface ReviewStepProps {
  payload: FlowDesignPayload;
}

/**
 * Step 4 — review the assembled payload before completion, laid out full-width:
 * a human-readable summary region on the left and a tall payload panel on the
 * right. The payload maps to the backend `CreateFlowCmd` → `DeployFlowCmd` →
 * `PublishVersionCmd` sequence, which the host performs once handed over.
 */
export const ReviewStep: FC<ReviewStepProps> = ({ payload }) => {
  const {
    basic,
    initiators,
    storageMode,
    formDefinition,
    flowDefinition
  } = payload;

  return (
    <div style={containerStyle}>
      <StepHeader
        index={4}
        title="完成"
        description={(
          <>
            确认流程定义,提交后宿主将依次执行
            {" "}
            <span style={monoStyle}>CreateFlowCmd → DeployFlowCmd → PublishVersionCmd</span>
          </>
        )}
      />

      <div style={columnsStyle}>
        <div style={{
          flex: "1.5 1 560px",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 20
        }}
        >
          <Card title="基本信息 → CreateFlowCmd">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="名称">{basic.name || "—"}</Descriptions.Item>
              <Descriptions.Item label="编码">{basic.code || "—"}</Descriptions.Item>

              <Descriptions.Item label="绑定模式">
                {basic.bindingMode === "business" ? `绑定业务表 ${basic.businessTable ?? ""}` : "独立存储"}
              </Descriptions.Item>

              <Descriptions.Item label="标题模板">{basic.instanceTitleTemplate || "—"}</Descriptions.Item>
              <Descriptions.Item label="管理员">{basic.adminUserIds.join(", ") || "—"}</Descriptions.Item>

              <Descriptions.Item label="发起人">
                {initiators.length === 0
                  ? "—"
                  : (
                      <span style={{
                        display: "inline-flex",
                        flexWrap: "wrap",
                        gap: 4
                      }}
                      >
                        {initiators.map((item, index) => (
                          <Tag key={index}>
                            {item.kind}
                            :
                            {item.ids.length}
                          </Tag>
                        ))}
                      </span>
                    )}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <div style={columnsStyle}>
            <Card
              style={{ flex: "1.4 1 320px", minWidth: 0 }}
              title={`表单与数据模型 → FormDefinition(${STORAGE_LABEL[storageMode]})`}
            >
              {formDefinition.fields.length === 0
                ? <Empty description="未设计任何字段" />
                : (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8
                    }}
                    >
                      {formDefinition.fields.map(field => (
                        <div
                          key={field.key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8
                          }}
                        >
                          <Tag style={{ marginInlineEnd: 0 }}>{field.kind}</Tag>
                          <span style={{ color: "var(--vef-color-text)" }}>{field.label}</span>

                          <span style={{
                            fontSize: 12,
                            color: "var(--vef-color-text-tertiary)"
                          }}
                          >
                            {field.key}
                            {field.isRequired ? " · 必填" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
            </Card>

            <Card style={{ flex: "1 1 220px", minWidth: 0 }} title="流程图 → FlowDefinition">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="节点">{flowDefinition.nodes.length}</Descriptions.Item>
                <Descriptions.Item label="连线">{flowDefinition.edges.length}</Descriptions.Item>
              </Descriptions>
            </Card>
          </div>
        </div>

        <div style={{
          flex: "1 1 420px",
          minWidth: 0,
          position: "sticky",
          top: 0
        }}
        >
          <Card title="完整 payload(提交给宿主)">
            <pre style={codeStyle}>
              {JSON.stringify(payload, null, 2)}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
};
