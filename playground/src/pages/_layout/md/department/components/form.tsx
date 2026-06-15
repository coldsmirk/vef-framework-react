import type { ReactNode } from "react";
import type { DepartmentParams } from "~apis";

import { Grid, useDataOptionsTreeSelect, useDictionaryOptionsSelect, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";
import { findDepartmentTreeOptions } from "~apis";

interface FormProps {
  orgId?: string;
}

const TEXTAREA_AUTO_SIZE = { minRows: 3, maxRows: 6 };

export function Form({ orgId }: FormProps): ReactNode {
  const { AppField } = useFormContext<DepartmentParams>();

  const parentDepartmentSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findDepartmentTreeOptions.key, { orgId }],
      queryFn: findDepartmentTreeOptions
    }
  });

  const {
    level: levelSelectProps,
    type: typeSelectProps
  } = useDictionaryOptionsSelect({
    level: "md.department.level",
    type: "md.department.type"
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
              {...parentDepartmentSelectProps}
              allowClear
              label="上级部门"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="name"
          validators={{ onBlur: z.string("必须").max(64, "最多64个字符") }}
        >
          {field => (
            <field.Input
              required
              label="部门名称"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="shortName"
          validators={{ onBlur: z.string("必须").max(32, "最多32个字符") }}
        >
          {field => (
            <field.Input
              required
              label="部门简称"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="level"
          validators={{ onChange: z.string("必须") }}
        >
          {field => (
            <field.Select
              {...levelSelectProps}
              required
              label="部门级别"
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
              {...typeSelectProps}
              required
              label="部门类型"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="location" validators={{ onBlur: z.string().max(128, "最多128个字符").nullish() }}>
          {field => <field.Input label="部门位置" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="isActive" validators={{ onChange: z.boolean("必须") }}>
          {field => <field.Bool required falseLabel="禁用" label="是否启用" trueLabel="启用" variant="radio" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="sortOrder" validators={{ onChange: z.number("必须是数字").min(0, "最小为0") }}>
          {field => <field.InputNumber required label="排序" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="introduction" validators={{ onBlur: z.string().max(512, "最多512个字符").nullish() }}>
          {field => <field.TextArea autoSize={TEXTAREA_AUTO_SIZE} label="部门简介" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="remark" validators={{ onBlur: z.string().max(256, "最多256个字符").nullish() }}>
          {field => <field.TextArea autoSize={TEXTAREA_AUTO_SIZE} label="备注" />}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
