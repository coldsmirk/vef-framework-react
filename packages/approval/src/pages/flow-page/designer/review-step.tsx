import type { ApprovalFormField } from "@vef-framework-react/approval-form-bridge";

import type { FlowDraft } from "./types";

import { WindowRuleSummary } from "@vef-framework-react/calendar";
import {
  Card,
  Descriptions,
  Flex,
  globalCssVars,
  Input,
  Labeled,
  LabelsDisplay,
  Stack,
  Switch,
  Tag,
  Text
} from "@vef-framework-react/components";

import { FieldCatalog } from "./field-catalog";
import { initiatorsForSubmit } from "./types";

export interface ReviewStepProps {
  draft: FlowDraft;
  businessKindLabel?: string;
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
  businessKindLabel,
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
              children: basic.businessBinding
                ? <Tag color="blue">{`业务表 ${basic.businessBinding?.tableName ?? ""}`}</Tag>
                : businessKindLabel ?? "流程表单"
            },
            {
              key: "initiation",
              label: "发起权限",
              // Count what will actually be saved: rules with nothing selected are
              // dropped on submit, so the draft length would overstate it.
              children: basic.isAllInitiationAllowed
                ? "所有人可发起"
                : `${initiatorsForSubmit(draft).length} 条发起规则`
            },
            {
              key: "window",
              label: "发起时段",
              children: <WindowRuleSummary rule={basic.initiationWindow} />
            },
            {
              key: "labels",
              label: "标签",
              children: <LabelsDisplay labels={basic.labels} />
            },
            {
              key: "storage",
              label: "存储模式",
              children: !basic.businessKind && draft.storageMode === "table" ? "独立表存储" : "JSON 存储"
            }
          ]}
        />
      </Card>

      <FieldCatalog fields={fields} title={`字段目录（${fields.length}）`} />

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
