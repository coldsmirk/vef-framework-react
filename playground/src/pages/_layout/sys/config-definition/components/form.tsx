import type { ReactNode } from "react";
import type { ConfigDefinitionParams } from "~apis";

import { Grid, useDictionaryOptionsSelect, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

const CONFIG_KEY_PATTERN = /^[\w.]+$/;
const MAX_KEY_LENGTH = 64;
const MAX_DESC_LENGTH = 256;
const TEXT_AREA_AUTO_SIZE = { minRows: 3, maxRows: 6 };

const validators = {
  category: { onChange: z.string().nullish() },
  key: {
    onBlur: z.string("必须")
      .regex(CONFIG_KEY_PATTERN, "只能包含字母、数字、下划线和点")
      .max(MAX_KEY_LENGTH, `最多${MAX_KEY_LENGTH}个字符`)
  },
  name: { onBlur: z.string("必须").max(MAX_KEY_LENGTH, `最多${MAX_KEY_LENGTH}个字符`) },
  valueType: { onChange: z.string("必须") },
  isRequired: { onChange: z.boolean("必须") },
  sortOrder: { onChange: z.number("必须是数字").min(0, "最小为0") },
  description: { onBlur: z.string().max(MAX_DESC_LENGTH, `最多${MAX_DESC_LENGTH}个字符`).nullish() },
  remark: { onBlur: z.string().max(MAX_DESC_LENGTH, `最多${MAX_DESC_LENGTH}个字符`).nullish() }
} as const;

export function Form(): ReactNode {
  const { AppField } = useFormContext<ConfigDefinitionParams>();
  const {
    category: categorySelectProps,
    valueType: valueTypeSelectProps
  } = useDictionaryOptionsSelect({
    category: "sys.config_definition.category",
    valueType: "sys.config_definition.value_type"
  });

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="category" validators={validators.category}>
          {field => (
            <field.Select
              {...categorySelectProps}
              label="配置分类"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="key" validators={validators.key}>
          {field => (
            <field.Input
              required
              label="配置键"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={validators.name}>
          {field => (
            <field.Input
              required
              label="配置名称"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="valueType" validators={validators.valueType}>
          {field => (
            <field.Select
              {...valueTypeSelectProps}
              required
              label="值类型"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="isRequired" validators={validators.isRequired}>
          {field => (
            <field.Bool
              required
              falseLabel="否"
              label="是否必填"
              trueLabel="是"
              variant="radio"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="sortOrder" validators={validators.sortOrder}>
          {field => (
            <field.InputNumber
              required
              label="排序"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="description" validators={validators.description}>
          {field => (
            <field.TextArea
              autoSize={TEXT_AREA_AUTO_SIZE}
              label="配置描述"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="remark" validators={validators.remark}>
          {field => (
            <field.TextArea
              autoSize={TEXT_AREA_AUTO_SIZE}
              label="备注"
            />
          )}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
