import type { ReactNode } from "react";
import type { DictionaryItemParams } from "~apis";

import { Grid, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

const CODE_PATTERN = /^[\w.]+$/;
const REMARK_AUTO_SIZE = { minRows: 3, maxRows: 6 } as const;

const validators = {
  name: { onBlur: z.string("必须").max(64, "最多64个字符") },
  code: { onBlur: z.string("必须").regex(CODE_PATTERN, "只能包含字母、数字、下划线和点").max(32, "最多32个字符") },
  sortOrder: { onChange: z.number("必须是数字").min(0, "最小为0") },
  isActive: { onChange: z.boolean("必须") },
  isVisible: { onChange: z.boolean("必须") },
  remark: { onBlur: z.string().max(256, "最多256个字符").nullish() }
} as const;

export function Form(): ReactNode {
  const { AppField } = useFormContext<DictionaryItemParams>();

  return (
    <Grid columnGap="small">
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
        <AppField name="code" validators={validators.code}>
          {field => (
            <field.Input
              required
              label="编码"
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
        <AppField name="isVisible" validators={validators.isVisible}>
          {field => (
            <field.Bool
              required
              falseLabel="隐藏"
              label="是否显示"
              trueLabel="显示"
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
