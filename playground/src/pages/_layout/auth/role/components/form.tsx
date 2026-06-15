import type { RoleParams } from "~apis";

import { Grid, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

const validators = {
  name: z.string("必须").max(32, "最多32个字符"),
  isActive: z.boolean("必须"),
  remark: z.string().max(256, "最多256个字符").nullish()
};

export function Form() {
  const { AppField } = useFormContext<RoleParams>();

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="name" validators={{ onBlur: validators.name }}>
          {field => (
            <field.Input
              required
              label="角色名称"
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
