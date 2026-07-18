import type { ReactNode } from "react";
import type { IdMappingParams } from "~apis";

import { Grid, useCodeSetOptionsSelect, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

const ALPHA_PATTERN = /^[a-z]+$/i;
const ALPHANUMERIC_PATTERN = /^[a-z0-9]+$/i;

const validators = {
  tableName: { onBlur: z.string("必须").regex(ALPHA_PATTERN, "只能包含字母").max(64, "最多64个字符") },
  externalApp: { onChange: z.string("必须") },
  id: { onBlur: z.string("必须").regex(ALPHANUMERIC_PATTERN, "只能包含字母和数字").max(32, "最多32个字符") }
} as const;

export function Form(): ReactNode {
  const { AppField } = useFormContext<IdMappingParams>();
  const { externalApp: externalAppSelectProps } = useCodeSetOptionsSelect({ externalApp: "md.id_mapping.external_app" });

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="tableName" validators={validators.tableName}>
          {field => <field.Input required label="表名" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="externalApp" validators={validators.externalApp}>
          {field => <field.Select {...externalAppSelectProps} required label="外部应用" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="fromId" validators={validators.id}>
          {field => <field.Input required label="本地ID" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="toId" validators={validators.id}>
          {field => <field.Input required label="外部ID" />}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
