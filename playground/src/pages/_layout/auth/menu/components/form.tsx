import type { Menu, MenuParams } from "~apis";

import { Grid, useDataOptionsSelect, useDataOptionsTreeSelect, useDictionaryOptionsSelect, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";
import { findAppOptions, findMenuTreeOptions } from "~apis";

import { useMenuSearchValues } from "../helpers";

type MenuType = Menu["type"];

const PATH_REQUIRED_TYPES = new Set<MenuType>(["D", "M", "V"]);
const ICON_DISABLED_TYPES = new Set<MenuType>(["P", "V"]);

const validators = {
  appId: z.string("必须").max(32, "最多32个字符"),
  parentId: z.string().max(32, "最多32个字符").nullish(),
  menuType: z.enum(["D", "M", "V", "P", "R"], "必须"),
  name: z.string("必须").max(32, "最多32个字符"),
  icon: z.string("必须").regex(/^[a-z0-9-]*$/i, "只能包含字母、数字和短横线").max(32, "最多32个字符"),
  path: z.string("必须").max(128, "最多128个字符"),
  permissionCode: z.string("必须").regex(/^[a-z0-9.]*$/, "只能包含字母、数字和点").max(64, "最多64个字符"),
  sortOrder: z.number("必须是数字").min(0, "最小为0"),
  isActive: z.boolean("必须"),
  remark: z.string().max(256, "最多256个字符").nullish()
};

function handleMenuTypeChange(value: MenuType, form: any): void {
  if (value === "P") {
    form.resetField("path");
    form.resetField("icon");
  }

  if (value === "V") {
    form.resetField("icon");
  }

  if (value !== "P") {
    form.resetField("permissionCode");
  }

  if (value !== "D") {
    form.setFieldMeta("icon", (prev: any) => {
      return {
        ...prev,
        errorMap: {},
        errors: []
      };
    });
  }
}

export function Form() {
  const { AppField, Subscribe } = useFormContext<MenuParams>();
  const searchValues = useMenuSearchValues();

  const appSelectProps = useDataOptionsSelect({
    filterable: true,
    queryOptions: {
      queryFn: findAppOptions,
      queryKey: [findAppOptions.key]
    }
  });

  const parentMenuSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryFn: findMenuTreeOptions,
      queryKey: [findMenuTreeOptions.key, { appId: searchValues.appId }]
    }
  });

  const { menuType: menuTypeSelectProps } = useDictionaryOptionsSelect({
    menuType: "sys.menu.type"
  });

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="appId" validators={{ onChange: validators.appId }}>
          {field => <field.Select {...appSelectProps} required label="应用" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="parentId" validators={{ onBlur: validators.parentId }}>
          {field => <field.TreeSelect {...parentMenuSelectProps} allowClear label="父级" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="type"
          validators={{ onChange: validators.menuType }}
          listeners={{
            onChange: ({ value, fieldApi: { form } }) => {
              handleMenuTypeChange(value, form);
            }
          }}
        >
          {field => <field.Select {...menuTypeSelectProps} required label="类型" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={{ onBlur: validators.name }}>
          {field => <field.Input required label="名称" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="icon"
          validators={{
            onChange: ({ value, fieldApi: { form } }) => {
              if (form.state.values.type === "D") {
                const result = validators.icon.safeParse(value);

                if (!result.success) {
                  return result.error.issues;
                }
              }
            }
          }}
        >
          {field => (
            <Subscribe selector={state => state.values.type}>
              {type => (
                <field.IconPicker
                  disabled={ICON_DISABLED_TYPES.has(type)}
                  label="图标"
                  placeholder="请选择图标"
                  required={type === "D"}
                />
              )}
            </Subscribe>
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="path"
          validators={{
            onBlur: ({ value, fieldApi: { form } }) => {
              if (form.state.values.type !== "P") {
                const result = validators.path.safeParse(value);

                if (!result.success) {
                  return result.error.issues;
                }
              }
            }
          }}
        >
          {field => (
            <Subscribe selector={state => state.values.type}>
              {type => (
                <field.Input
                  disabled={type === "P"}
                  label="菜单路径"
                  required={PATH_REQUIRED_TYPES.has(type)}
                />
              )}
            </Subscribe>
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="permissionCode"
          validators={{
            onBlur: ({ value, fieldApi: { form } }) => {
              if (form.state.values.type === "P") {
                const result = validators.permissionCode.safeParse(value);

                if (!result.success) {
                  return result.error.issues;
                }
              }
            }
          }}
        >
          {field => (
            <Subscribe selector={state => state.values.type}>
              {type => (
                <field.Input
                  disabled={type !== "P"}
                  label="权限编码"
                  required={type === "P"}
                />
              )}
            </Subscribe>
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="sortOrder" validators={{ onChange: validators.sortOrder }}>
          {field => <field.InputNumber required label="排序" />}
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
          {field => <field.TextArea autoSize={{ minRows: 3, maxRows: 6 }} label="备注" />}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
