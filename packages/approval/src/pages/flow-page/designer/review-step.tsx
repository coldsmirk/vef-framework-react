import type { ApprovalFormField } from "@vef-framework-react/approval-form-bridge";

import type { FlowDraft } from "./types";

import {
  Card,
  Descriptions,
  Flex,
  globalCssVars,
  Input,
  Labeled,
  Stack,
  Switch,
  Table,
  Tag,
  Text
} from "@vef-framework-react/components";

import { LabelsDisplay } from "../../../components";

export interface ReviewStepProps {
  draft: FlowDraft;
  /**
   * The deploy-derived field inventory (from the client-side projection).
   */
  fields: ApprovalFormField[];
  versionDescription: string;
  publishNow: boolean;
  onVersionDescriptionChange: (value: string) => void;
  onPublishNowChange: (value: boolean) => void;
}

/**
 * Step 4 — review the assembled draft and choose the release options. Submit
 * runs create/update → deploy → optional publish as one chain.
 */
export function ReviewStep({
  draft,
  fields,
  versionDescription,
  publishNow,
  onVersionDescriptionChange,
  onPublishNowChange
}: ReviewStepProps) {
  const { basic } = draft;
  const nodeCount = draft.flowDefinition.nodes.length;

  return (
    <Stack
      gap={16}
      style={{
        maxWidth: 920,
        marginInline: "auto",
        width: "100%"
      }}
    >
      <Card title="流程设置">
        <Descriptions
          colon
          column={{ xs: 1, sm: 2 }}
          size="small"
          items={[
            {
              key: "code",
              label: "流程编码",
              children: <Text code>{basic.code}</Text>
            },
            {
              key: "name",
              label: "流程名称",
              children: basic.name
            },
            {
              key: "binding",
              label: "业务绑定",
              children: basic.bindingMode === "business"
                ? <Tag color="blue">{`业务表 ${basic.businessBinding?.tableName ?? ""}`}</Tag>
                : <Tag>独立存储</Tag>
            },
            {
              key: "initiation",
              label: "发起权限",
              children: basic.isAllInitiationAllowed ? "所有人可发起" : `${draft.initiators.length} 条发起规则`
            },
            {
              key: "labels",
              label: "标签",
              children: <LabelsDisplay labels={basic.labels} />
            },
            {
              key: "storage",
              label: "存储模式",
              children: draft.storageMode === "table" ? "独立表存储" : "JSON 存储"
            }
          ]}
        />
      </Card>

      <Card title={`表单字段（${fields.length}）`}>
        {fields.length === 0
          ? <Text type="secondary">该流程未设计表单。</Text>
          : (
              <Table<ApprovalFormField>
                dataSource={fields}
                pagination={false}
                rowKey="key"
                size="small"
                columns={[
                  {
                    title: "字段键",
                    dataIndex: "key",
                    width: 220,
                    render: (value: string) => <Text code>{value}</Text>
                  },
                  { title: "名称", dataIndex: "label" },
                  {
                    title: "类型",
                    dataIndex: "kind",
                    width: 120,
                    render: (value: string) => <Tag>{value}</Tag>
                  }
                ]}
              />
            )}
      </Card>

      <Card title="发布选项">
        <Stack gap={12}>
          <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
            {`流程图共 ${nodeCount} 个节点。提交将保存流程设置并部署为新版本；发布后新发起的审批立即走新版本，进行中的实例仍沿用其原版本。`}
          </Text>

          <Labeled label="版本说明">
            <Input.TextArea
              maxLength={500}
              placeholder="本次变更说明（可选）"
              rows={2}
              value={versionDescription}
              onChange={event => onVersionDescriptionChange(event.target.value)}
            />
          </Labeled>

          <Flex align="center" gap="small">
            <Switch checked={publishNow} onChange={onPublishNowChange} />
            <Text>部署后立即发布</Text>
          </Flex>
        </Stack>
      </Card>
    </Stack>
  );
}
