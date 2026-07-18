import type { ReactNode } from "react";
import type { DistrictParams } from "~apis";

import { Grid, useCodeSetOptionsSelect, useDataOptionsTreeSelect, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";
import { useMemo } from "react";
import { findDistrictTreeOptions } from "~apis";

const TEXTAREA_AUTO_SIZE = { minRows: 3, maxRows: 6 };

export function Form(): ReactNode {
  const { AppField } = useFormContext<DistrictParams>();

  const { level: levelSelectProps } = useCodeSetOptionsSelect({
    level: "md.district.level"
  });

  const levelOptions = useMemo(() => levelSelectProps.options?.map(option => {
    return {
      ...option,
      intValue: Number(option.value)
    };
  }), [levelSelectProps.options]);

  const parentDistrictSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findDistrictTreeOptions.key],
      queryFn: findDistrictTreeOptions
    }
  });

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="parentId" validators={{ onChange: z.string().nullish() }}>
          {field => <field.TreeSelect {...parentDistrictSelectProps} allowClear label="上级区划" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="code" validators={{ onBlur: z.string("必须").max(32, "最多32个字符") }}>
          {field => <field.Input required label="区划代码" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={{ onBlur: z.string("必须").max(64, "最多64个字符") }}>
          {field => <field.Input required label="区划名称" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="shortName" validators={{ onBlur: z.string().max(32, "最多32个字符").nullish() }}>
          {field => <field.Input label="简称" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="level" validators={{ onChange: z.number("必须") }}>
          {field => (
            <field.Select
              {...levelSelectProps}
              required
              fieldNames={{ value: "intValue" }}
              label="级别"
              options={levelOptions}
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="spellCode" validators={{ onBlur: z.string().max(64, "最多64个字符").nullish() }}>
          {field => <field.Input label="拼音码" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="strokeCode" validators={{ onBlur: z.string().max(64, "最多64个字符").nullish() }}>
          {field => <field.Input label="五笔码" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="postcode" validators={{ onBlur: z.string().max(10, "最多10个字符").nullish() }}>
          {field => <field.Input label="邮政编码" />}
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
        <AppField name="remark" validators={{ onBlur: z.string().max(256, "最多256个字符").nullish() }}>
          {field => <field.TextArea autoSize={TEXTAREA_AUTO_SIZE} label="备注" />}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
