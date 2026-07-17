import type { CategoryParams, FlowCategory } from "../../types";

import { Grid, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

const codeSchema = z.string("请输入分类编码").min(1, "请输入分类编码");
const nameSchema = z.string("请输入分类名称").min(1, "请输入分类名称");

/**
 * One parent-selector option in the framework's `DataOption` shape.
 */
export interface CategoryTreeOption {
  label: string;
  value: string;
  children?: CategoryTreeOption[];
}

/**
 * Map the loaded category tree into TreeSelect options. The node being
 * edited (and thus its whole subtree) is excluded so a category can never be
 * made its own descendant.
 */
export function buildCategoryTreeOptions(categories: FlowCategory[], excludeId?: string): CategoryTreeOption[] {
  const options: CategoryTreeOption[] = [];

  for (const category of categories) {
    if (excludeId !== undefined && category.id === excludeId) {
      continue;
    }

    options.push({
      label: category.name,
      value: category.id,
      children: buildCategoryTreeOptions(category.children ?? [], excludeId)
    });
  }

  return options;
}

export interface CategoryFormProps {
  /**
   * The loaded category tree, for the parent selector.
   */
  treeOptions: CategoryTreeOption[];
}

/**
 * The create/update form body for a flow category.
 */
export function CategoryForm({ treeOptions }: CategoryFormProps) {
  const { AppField } = useFormContext<CategoryParams>();

  return (
    <Grid columnGap="small">
      <Grid.Item span={24}>
        <AppField name="parentId">
          {field => (
            <field.TreeSelect
              allowClear
              label="上级分类"
              placeholder="留空表示顶级分类"
              treeData={treeOptions}
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="code" validators={{ onChange: codeSchema }}>
          {field => <field.Input required label="分类编码" placeholder="如 hr / finance" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={{ onChange: nameSchema }}>
          {field => <field.Input required label="分类名称" placeholder="如 人事审批" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="icon">
          {field => <field.IconPicker allowClear label="图标" placeholder="选择图标（可选）" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="sortOrder">
          {field => <field.InputNumber extra="数字越小越靠前" label="排序" min={0} style={{ width: "100%" }} />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="remark">
          {field => <field.TextArea label="备注" maxLength={500} placeholder="补充说明（可选）" rows={2} />}
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
