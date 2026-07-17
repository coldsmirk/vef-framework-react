import type { PrincipalKind } from "@vef-framework-react/approval-flow-editor";

import type { BusinessBindingConfig, InitiatorParams, InstanceStatus } from "../../../types";
import type { CategoryTreeOption } from "../../category-page/form";
import type { FlowDraftBasic } from "./types";

import {
  Button,
  Card,
  Collapse,
  Flex,
  globalCssVars,
  Grid,
  Icon,
  IconPicker,
  Input,
  Labeled,
  LabelsEditor,
  Radio,
  Select,
  Stack,
  Switch,
  Text,
  TreeSelect
} from "@vef-framework-react/components";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { PrincipalSelect } from "../../../components";
import { INSTANCE_STATUS_LABELS } from "../../../components/status/labels";

const INITIATOR_KIND_OPTIONS: Array<{ label: string; value: PrincipalKind }> = [
  { label: "用户", value: "user" },
  { label: "角色", value: "role" },
  { label: "部门", value: "department" }
];

/**
 * The initiator rule rows: each row is one principal kind plus its ids;
 * rules are OR-combined by the engine.
 */
function InitiatorsEditor({
  initiators,
  onChange
}: {
  initiators: InitiatorParams[];
  onChange: (next: InitiatorParams[]) => void;
}) {
  function updateRow(index: number, patch: Partial<InitiatorParams>): void {
    onChange(initiators.map((row, i) => i === index ? { ...row, ...patch } : row));
  }

  return (
    <Stack gap={8}>
      {initiators.map((row, index) => (
        // Rows have no identity beyond their position.
        <Flex key={index} align="center" gap="small">
          <Select
            options={INITIATOR_KIND_OPTIONS}
            style={{ width: 100, flexShrink: 0 }}
            value={row.kind}
            onChange={kind => updateRow(index, { kind, ids: [] })}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <PrincipalSelect kind={row.kind} value={row.ids} onChange={ids => updateRow(index, { ids })} />
          </div>

          <Button
            icon={<Icon component={Trash2Icon} />}
            onClick={() => onChange(initiators.filter((_, i) => i !== index))}
          />
        </Flex>
      ))}

      <Button
        block
        icon={<Icon component={PlusIcon} />}
        type="dashed"
        onClick={() => onChange([...initiators, { kind: "user", ids: [] }])}
      >
        添加发起规则
      </Button>
    </Stack>
  );
}

const PROJECTABLE_STATUSES: readonly InstanceStatus[] = ["running", "approved", "rejected", "withdrawn", "returned", "terminated"];

/**
 * The business write-back configuration. Key columns must exactly match a
 * complete primary/unique key on the target table; the instance-id column is
 * the compare-and-set fence and is mandatory.
 */
function BusinessBindingEditor({
  binding,
  onChange
}: {
  binding: BusinessBindingConfig;
  onChange: (next: BusinessBindingConfig) => void;
}) {
  return (
    <Stack gap={12}>
      <Grid columnGap="small" rowGap={12}>
        <Grid.Item span={12}>
          <Labeled required label="业务表名">
            <Input
              placeholder="如 biz_purchase_order"
              value={binding.tableName}
              onChange={event => onChange({ ...binding, tableName: event.target.value })}
            />
          </Labeled>
        </Grid.Item>

        <Grid.Item span={12}>
          <Labeled required hint="必须与业务表上的主键或唯一键完全一致" label="记录键列">
            <Select<string[]>
              mode="tags"
              open={false}
              placeholder="输入列名，回车添加"
              style={{ width: "100%" }}
              value={binding.keyColumns}
              onChange={keyColumns => onChange({ ...binding, keyColumns })}
            />
          </Labeled>
        </Grid.Item>

        <Grid.Item span={12}>
          <Labeled required label="状态列">
            <Input
              placeholder="如 approval_status"
              value={binding.statusColumn}
              onChange={event => onChange({ ...binding, statusColumn: event.target.value })}
            />
          </Labeled>
        </Grid.Item>

        <Grid.Item span={12}>
          <Labeled required hint="防止过期实例覆盖新一轮审批的写入" label="实例 ID 列">
            <Input
              placeholder="如 approval_instance_id"
              value={binding.instanceIdColumn ?? ""}
              onChange={event => onChange({ ...binding, instanceIdColumn: event.target.value || undefined })}
            />
          </Labeled>
        </Grid.Item>

        <Grid.Item span={12}>
          <Labeled label="开始时间列">
            <Input
              placeholder="可选"
              value={binding.startedAtColumn ?? ""}
              onChange={event => onChange({ ...binding, startedAtColumn: event.target.value || undefined })}
            />
          </Labeled>
        </Grid.Item>

        <Grid.Item span={12}>
          <Labeled label="完成时间列">
            <Input
              placeholder="可选"
              value={binding.finishedAtColumn ?? ""}
              onChange={event => onChange({ ...binding, finishedAtColumn: event.target.value || undefined })}
            />
          </Labeled>
        </Grid.Item>
      </Grid>

      <Collapse
        ghost
        items={[
          {
            key: "statusMapping",
            label: "状态映射（可选，缺省写入状态原文）",
            children: (
              <Grid columnGap="small" rowGap={12}>
                {PROJECTABLE_STATUSES.map(status => (
                  <Grid.Item key={status} span={8}>
                    <Labeled label={INSTANCE_STATUS_LABELS[status]}>
                      <Input
                        placeholder={status}
                        value={binding.statusMapping?.[status] ?? ""}
                        onChange={event => {
                          const next = { ...binding.statusMapping };

                          if (event.target.value === "") {
                            delete next[status];
                          } else {
                            next[status] = event.target.value;
                          }

                          onChange({ ...binding, statusMapping: next });
                        }}
                      />
                    </Labeled>
                  </Grid.Item>
                ))}
              </Grid>
            )
          }
        ]}
      />
    </Stack>
  );
}

const EMPTY_BINDING: BusinessBindingConfig = {
  tableName: "",
  keyColumns: [],
  statusColumn: "",
  instanceIdColumn: undefined
};

export interface BasicStepProps {
  basic: FlowDraftBasic;
  initiators: InitiatorParams[];
  categoryOptions: CategoryTreeOption[];
  /**
   * The flow code is immutable after creation.
   */
  isEditing: boolean;
  onBasicChange: (patch: Partial<FlowDraftBasic>) => void;
  onInitiatorsChange: (next: InitiatorParams[]) => void;
}

/**
 * Step 1 — the flow's settings: identity, labels, initiation permission, and
 * the business binding. Everything here lands in `create`/`update`; the
 * deployable definition follows in the next steps.
 */
export function BasicStep({
  basic,
  initiators,
  categoryOptions,
  isEditing,
  onBasicChange,
  onInitiatorsChange
}: BasicStepProps) {
  return (
    <Stack
      gap={16}
      style={{
        maxWidth: 920,
        marginInline: "auto",
        width: "100%"
      }}
    >
      <Card title="基本信息">
        <Grid columnGap="small" rowGap={12}>
          <Grid.Item span={12}>
            <Labeled required hint={isEditing ? "流程编码创建后不可修改" : "唯一标识，创建后不可修改"} label="流程编码">
              <Input
                disabled={isEditing}
                placeholder="如 leave-request"
                value={basic.code}
                onChange={event => onBasicChange({ code: event.target.value })}
              />
            </Labeled>
          </Grid.Item>

          <Grid.Item span={12}>
            <Labeled required label="流程名称">
              <Input
                placeholder="如 请假审批"
                value={basic.name}
                onChange={event => onBasicChange({ name: event.target.value })}
              />
            </Labeled>
          </Grid.Item>

          <Grid.Item span={12}>
            <Labeled required label="所属分类">
              <TreeSelect
                placeholder="选择流程分类"
                style={{ width: "100%" }}
                treeData={categoryOptions}
                value={basic.categoryId || undefined}
                onChange={categoryId => onBasicChange({ categoryId })}
              />
            </Labeled>
          </Grid.Item>

          <Grid.Item span={12}>
            <Labeled label="图标">
              <IconPicker
                allowClear
                placeholder="选择图标（可选）"
                style={{ width: "100%" }}
                value={basic.icon}
                onChange={icon => onBasicChange({ icon: icon ?? undefined })}
              />
            </Labeled>
          </Grid.Item>

          <Grid.Item span={24}>
            <Labeled
              required
              hint="支持 {{.flowName}} / {{.instanceNo}} / {{.applicantName}} / {{.formData.字段}} 模板变量"
              label="单据标题模板"
            >
              <Input
                placeholder="如 {{.applicantName}}的请假申请（{{.instanceNo}}）"
                value={basic.instanceTitleTemplate}
                onChange={event => onBasicChange({ instanceTitleTemplate: event.target.value })}
              />
            </Labeled>
          </Grid.Item>

          <Grid.Item span={24}>
            <Labeled label="流程描述">
              <Input.TextArea
                maxLength={500}
                placeholder="描述该流程的用途（可选）"
                rows={2}
                value={basic.description ?? ""}
                onChange={event => onBasicChange({ description: event.target.value || undefined })}
              />
            </Labeled>
          </Grid.Item>

          <Grid.Item span={24}>
            <Labeled hint="管理员可作为空审批人/超时的兜底处理人" label="流程管理员">
              <PrincipalSelect
                kind="user"
                value={basic.adminUserIds}
                onChange={adminUserIds => onBasicChange({ adminUserIds })}
              />
            </Labeled>
          </Grid.Item>
        </Grid>
      </Card>

      <Card title="流程标签">
        <Stack gap={8}>
          <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
            标签用于业务方自定义筛选，例如所属应用（app: crm）或移动端可发起（mobile）。列表与发起接口均支持按标签过滤。
          </Text>

          <LabelsEditor value={basic.labels} onChange={labels => onBasicChange({ labels })} />
        </Stack>
      </Card>

      <Card title="发起权限">
        <Stack gap={12}>
          <Flex align="center" gap="small">
            <Switch
              checked={basic.isAllInitiationAllowed}
              onChange={isAllInitiationAllowed => onBasicChange({ isAllInitiationAllowed })}
            />

            <Text>所有人可发起</Text>
          </Flex>

          {!basic.isAllInitiationAllowed
            && <InitiatorsEditor initiators={initiators} onChange={onInitiatorsChange} />}
        </Stack>
      </Card>

      <Card title="业务绑定">
        <Stack gap={12}>
          <Radio.Group
            optionType="button"
            value={basic.bindingMode}
            options={[
              { label: "独立存储", value: "standalone" },
              { label: "绑定业务表", value: "business" }
            ]}
            onChange={event => {
              const mode = event.target.value;

              if (mode === "standalone" || mode === "business") {
                onBasicChange({ bindingMode: mode });
              }
            }}
          />

          <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
            {basic.bindingMode === "standalone"
              ? "表单数据存储在审批系统内，适合独立审批单。"
              : "审批状态回写到既有业务表，业务记录是事实源，审批引擎按版本快照投影状态。"}
          </Text>

          {basic.bindingMode === "business" && (
            <BusinessBindingEditor
              binding={basic.businessBinding ?? EMPTY_BINDING}
              onChange={businessBinding => onBasicChange({ businessBinding })}
            />
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
