import type { ReactNode } from "react";
import type { SerialNoRuleParams } from "~apis";

import { Grid, useCodeSetOptionsSelect, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

const REMARK_AUTO_SIZE = { minRows: 3, maxRows: 6 } as const;

const validators = {
  key: { onBlur: z.string("必须").max(64, "最多64个字符") },
  name: { onBlur: z.string("必须").max(64, "最多64个字符") },
  prefix: { onBlur: z.string().max(32, "最多32个字符").nullish() },
  suffix: { onBlur: z.string().max(32, "最多32个字符").nullish() },
  dateFormat: { onBlur: z.string().max(32, "最多32个字符").nullish() },
  seqLength: { onChange: z.number("必须是数字").min(1, "最小为1").max(20, "最大为20") },
  seqStep: { onChange: z.number("必须是数字").min(1, "最小为1") },
  resetCycle: { onBlur: z.string("必须").length(1, "至少需要选择一个") },
  isActive: { onChange: z.boolean("必须") },
  remark: { onBlur: z.string().max(256, "最多256个字符").nullish() }
} as const;

export function Form(): ReactNode {
  const { AppField } = useFormContext<SerialNoRuleParams>();
  const {
    dateFormat: dateFormatSelectProps,
    resetCycle: resetCycleSelectProps
  } = useCodeSetOptionsSelect({
    dateFormat: "sys.serial_no_rule.date_format",
    resetCycle: "sys.serial_no_rule.reset_cycle"
  });

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="key" validators={validators.key}>
          {field => (
            <field.Input
              required
              label="规则标识"
              placeholder="比如: order_no"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={validators.name}>
          {field => (
            <field.Input
              required
              label="规则名称"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="prefix" validators={validators.prefix}>
          {field => (
            <field.Input
              label="前缀"
              placeholder="比如: ORD"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="suffix" validators={validators.suffix}>
          {field => (
            <field.Input
              label="后缀"
              placeholder="可选"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="dateFormat" validators={validators.dateFormat}>
          {field => (
            <field.Select
              {...dateFormatSelectProps}
              allowClear
              label="日期格式"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="seqLength" validators={validators.seqLength}>
          {field => (
            <field.InputNumber
              required
              label="序列长度"
              max={20}
              min={1}
              placeholder="1-20"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="seqStep" validators={validators.seqStep}>
          {field => (
            <field.InputNumber
              required
              label="序列步长"
              min={1}
              placeholder="默认为1"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="resetCycle" validators={validators.resetCycle}>
          {field => (
            <field.Select
              {...resetCycleSelectProps}
              required
              label="重置周期"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="isActive" validators={validators.isActive}>
          {field => (
            <field.Bool
              required
              falseLabel="禁用"
              label="是否启用"
              trueLabel="启用"
              variant="radio"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="remark" validators={validators.remark}>
          {field => (
            <field.TextArea
              autoSize={REMARK_AUTO_SIZE}
              label="备注"
            />
          )}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
