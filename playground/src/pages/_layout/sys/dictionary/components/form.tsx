import type { ReactNode } from "react";
import type { DictionaryParams } from "~apis";

import { Grid, useDataOptionsTreeSelect, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";
import { findDictionaryTreeOptions } from "~apis";

const TYPE_OPTIONS = [
  { label: "目录", value: "D" },
  { label: "字典", value: "T" }
] as const;

const REMARK_AUTO_SIZE = { minRows: 3, maxRows: 6 } as const;

const validators = {
  type: { onBlur: z.string("必须").regex(/^[A-Z]+$/, "只能包含字母").max(1, "最多1个字符") },
  parentId: { onChange: z.string().regex(/^[a-z0-9]+$/, "只能包含字母和数字").max(32, "最多32个字符").nullish() },
  name: { onBlur: z.string("必须").max(64, "最多64个字符") },
  key: { onBlur: z.string("必须").regex(/^[a-z0-9_.]+$/, "只能包含字母、数字、下划线和点").max(64, "最多64个字符") },
  isActive: { onChange: z.boolean("必须") },
  sortOrder: { onChange: z.number("必须是数字").min(0, "最小为0") },
  remark: { onBlur: z.string().max(256, "最多256个字符").nullish() }
} as const;

export function Form(): ReactNode {
  const { AppField } = useFormContext<DictionaryParams>();
  const parentDictSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findDictionaryTreeOptions.key],
      queryFn: findDictionaryTreeOptions
    }
  });

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="type" validators={validators.type}>
          {field => (
            <field.Radio
              required
              label="类型"
              options={[...TYPE_OPTIONS]}
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="parentId" validators={validators.parentId}>
          {field => (
            <field.TreeSelect
              {...parentDictSelectProps}
              allowClear
              label="父级"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={validators.name}>
          {field => (
            <field.Input
              required
              label="名称"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="key" validators={validators.key}>
          {field => (
            <field.Input
              required
              label="字典键"
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
