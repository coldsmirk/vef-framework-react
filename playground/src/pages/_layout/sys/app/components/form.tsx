import type { ReactNode } from "react";
import type { AppParams } from "~apis";

import { Grid, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

const validators = {
  id: z.string("必须").regex(/^[a-z0-9]+$/i, "只能包含字母和数字").max(32, "最多32个字符"),
  name: z.string("必须").max(64, "最多64个字符"),
  icon: z.string().regex(/^[a-z0-9-]*$/i, "只能包含字母、数字和短横线").max(32, "最多32个字符").nullish(),
  url: z.string().url("必须是有效的URL").max(255, "最多255个字符").nullish(),
  sortOrder: z.number("必须是数字").min(0, "最小为0"),
  isActive: z.boolean("必须"),
  remark: z.string().max(256, "最多256个字符").nullish()
};

export function Form(): ReactNode {
  const { AppField } = useFormContext<AppParams>();

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="id" validators={{ onBlur: validators.id }}>
          {field => (
            <field.Input
              required
              label="ID"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={{ onBlur: validators.name }}>
          {field => (
            <field.Input
              required
              label="名称"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="icon" validators={{ onBlur: validators.icon }}>
          {field => <field.IconPicker label="图标" placeholder="请选择图标" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="url" validators={{ onBlur: validators.url }}>
          {field => <field.Input label="链接地址" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="sortOrder" validators={{ onChange: validators.sortOrder }}>
          {field => (
            <field.InputNumber
              required
              label="排序"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="isActive" validators={{ onChange: validators.isActive }}>
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
        <AppField name="remark" validators={{ onBlur: validators.remark }}>
          {field => (
            <field.TextArea
              autoSize={{ minRows: 3, maxRows: 6 }}
              label="备注"
            />
          )}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
