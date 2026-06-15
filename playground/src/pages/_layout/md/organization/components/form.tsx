import type { ReactNode } from "react";
import type { OrganizationParams } from "~apis";

import { Grid, useDataOptionsTreeSelect, useDictionaryOptionsSelect, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";
import { findOrganizationTreeOptions } from "~apis";

const TEXTAREA_AUTO_SIZE = { minRows: 3, maxRows: 6 };
const ALPHANUMERIC_PATTERN = /^[a-z0-9]+$/i;

export function Form(): ReactNode {
  const { AppField } = useFormContext<OrganizationParams>();

  const parentOrgSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findOrganizationTreeOptions.key],
      queryFn: findOrganizationTreeOptions
    }
  });

  const {
    orgType: orgTypeSelectProps,
    hospitalLevel: hospitalLevelSelectProps
  } = useDictionaryOptionsSelect({
    orgType: "md.organization.type",
    hospitalLevel: "md.organization.hospital_level"
  });

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField
          name="parentId"
          validators={{ onChange: z.string().nullish() }}
        >
          {field => (
            <field.TreeSelect
              {...parentOrgSelectProps}
              allowClear
              label="上级机构"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="type"
          validators={{ onChange: z.string("必须") }}
        >
          {field => (
            <field.Select
              {...orgTypeSelectProps}
              required
              label="机构类型"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="code"
          validators={{ onBlur: z.string("必须").regex(ALPHANUMERIC_PATTERN, "只能包含字母和数字").max(32, "最多32个字符") }}
        >
          {field => <field.Input required label="机构编码" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="name"
          validators={{ onBlur: z.string("必须").max(64, "最多64个字符") }}
        >
          {field => <field.Input required label="机构名称" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="shortName"
          validators={{ onBlur: z.string("必须").max(32, "最多32个字符") }}
        >
          {field => <field.Input required label="机构简称" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="hospitalLevel"
          validators={{ onChange: z.string().nullish() }}
        >
          {field => (
            <field.Select
              {...hospitalLevelSelectProps}
              allowClear
              label="医院级别"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="logo">
          {field => (
            <field.Upload
              enableCrop
              public
              label="机构徽标"
              listType="picture-card"
              maxCount={1}
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="sortOrder"
          validators={{ onChange: z.number("必须是数字").min(0, "最小为0") }}
        >
          {field => <field.InputNumber required label="排序" />}
        </AppField>

        <AppField
          name="isActive"
          validators={{ onChange: z.boolean("必须") }}
        >
          {field => <field.Bool required falseLabel="禁用" label="是否启用" trueLabel="启用" variant="radio" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField
          name="introduction"
          validators={{ onBlur: z.string().max(512, "最多512个字符").nullish() }}
        >
          {field => <field.TextArea autoSize={TEXTAREA_AUTO_SIZE} label="机构简介" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField
          name="remark"
          validators={{ onBlur: z.string().max(256, "最多256个字符").nullish() }}
        >
          {field => <field.TextArea autoSize={TEXTAREA_AUTO_SIZE} label="备注" />}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
