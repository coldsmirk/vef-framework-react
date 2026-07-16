import type { DelegationParams } from "../../types";

import { Grid, Stack, Text, useFormContext } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { useMemo } from "react";

import { useCategoryApi } from "../../api";
import { PrincipalSelect } from "../../components";
import { buildCategoryTreeOptions } from "../category-page/form";

/**
 * A single-user principal field bound to a nullable string form value,
 * rendered through the host's user picker (or the id-tags fallback).
 */
function UserField({
  label,
  required,
  value,
  onChange
}: {
  label: string;
  required?: boolean;
  value: string | null | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const ids = useMemo(() => value ? [value] : [], [value]);

  return (
    <Stack gap={4}>
      <Text>
        {required ? <Text type="danger">* </Text> : null}
        {label}
      </Text>

      <PrincipalSelect kind="user" maxCount={1} value={ids} onChange={next => onChange(next[0])} />
    </Stack>
  );
}

/**
 * The create/update form body for a delegation: who delegates to whom, the
 * active window, and the optional flow/category scope (both empty = all
 * flows).
 */
export function DelegationForm() {
  const { AppField } = useFormContext<DelegationParams>();
  const categoryApi = useCategoryApi();

  const { data: categories } = useQuery({ queryFn: categoryApi.findTree, queryKey: [categoryApi.findTree.key, {}] });
  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories ?? []), [categories]);

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="delegatorId">
          {field => (
            <UserField
              required
              label="委托人"
              value={field.state.value}
              onChange={id => field.handleChange(id ?? "")}
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="delegateeId">
          {field => (
            <UserField
              required
              label="被委托人"
              value={field.state.value}
              onChange={id => field.handleChange(id ?? "")}
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="startTime">
          {field => <field.DatePicker required showTime label="开始时间" placeholder="选择开始时间" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="endTime">
          {field => <field.DatePicker required showTime label="结束时间" placeholder="选择结束时间" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="flowCategoryId">
          {field => (
            <field.TreeSelect
              allowClear
              extra="留空表示不限分类"
              label="限定分类"
              placeholder="选择流程分类（可选）"
              treeData={categoryOptions}
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="reason">
          {field => <field.TextArea label="委托原因" maxLength={500} placeholder="委托原因（可选）" rows={2} />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="isActive">
          {field => <field.Bool label="启用" variant="switch" />}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
