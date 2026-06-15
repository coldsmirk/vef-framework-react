import type { CrudBasicFormScene } from "@vef-framework-react/components";
import type { UserCreateParams, UserUpdateParams } from "~apis";

import { Grid, useDataOptionsSelect, useDictionaryOptionsSelect, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";
import { findRoleOptions, findStaffOptions } from "~apis";

export interface FormProps {
  scene: CrudBasicFormScene;
}

const validators = {
  name: z.string("必须").min(2, "最少2个字符").max(16, "最多16个字符"),
  username: z.string("必须").min(2, "最少2个字符").max(16, "最多16个字符"),
  passwordRequired: z.string("必须").min(6, "最少6个字符").max(16, "最多16个字符"),
  phoneNumber: z.string().min(6, "最少6个字符").max(16, "最多16个字符").nullish(),
  email: z.email().min(6, "最少6个字符").max(32, "最多32个字符").nullish(),
  gender: z.string("必须"),
  isActive: z.boolean("必须"),
  isLocked: z.boolean("必须"),
  staffId: z.string().max(32, "最多32个字符").nullish(),
  roleIds: z.array(z.string("必须").max(32, "最多32个字符")).optional(),
  remark: z.string().max(256, "最多256个字符").nullish()
};

export function Form({ scene }: FormProps) {
  const { AppField } = useFormContext<UserCreateParams | UserUpdateParams>();

  const { gender: genderSelectProps } = useDictionaryOptionsSelect({
    gender: "common.gender"
  });

  const staffSelectProps = useDataOptionsSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findStaffOptions.key, {}],
      queryFn: findStaffOptions
    }
  });

  const roleSelectProps = useDataOptionsSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findRoleOptions.key],
      queryFn: findRoleOptions
    }
  });

  const isCreate = scene === "create";

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="avatar">
          {field => (
            <field.Upload
              enableCrop
              public
              label="头像"
              listType="picture-circle"
              maxCount={1}
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={{ onBlur: validators.name }}>
          {field => <field.Input required label="姓名" />}
        </AppField>

        <AppField name="username" validators={{ onBlur: validators.username }}>
          {field => <field.Input required label="账号" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField
          name="password"
          validators={{ onBlur: isCreate ? validators.passwordRequired : undefined }}
        >
          {field => <field.Password label="密码" required={isCreate} />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="phoneNumber" validators={{ onBlur: validators.phoneNumber }}>
          {field => <field.Input label="手机号码" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="email" validators={{ onBlur: validators.email }}>
          {field => <field.Input label="邮箱" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="gender" validators={{ onChange: validators.gender }}>
          {field => <field.Select {...genderSelectProps} required label="性别" />}
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

      <Grid.Item span={12}>
        <AppField name="isLocked" validators={{ onChange: validators.isLocked }}>
          {field => (
            <field.Bool
              disabled
              required
              falseLabel="正常"
              label="是否锁定"
              trueLabel="锁定"
              variant="radio"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="staffId" validators={{ onChange: validators.staffId }}>
          {field => <field.Select {...staffSelectProps} allowClear label="关联职工" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="roleIds" validators={{ onChange: validators.roleIds }}>
          {field => <field.Select {...roleSelectProps} allowClear label="角色" mode="multiple" />}
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
