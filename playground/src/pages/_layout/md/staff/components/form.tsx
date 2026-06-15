import type { ReactNode } from "react";
import type { StaffParams } from "~apis";

import { Grid, useDictionaryOptionsSelect, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

const ALPHANUMERIC_PATTERN = /^[a-z0-9]+$/i;
const TEXTAREA_AUTO_SIZE = { minRows: 3, maxRows: 6 };

export function Form(): ReactNode {
  const { AppField } = useFormContext<StaffParams>();

  const {
    category,
    gender,
    idType,
    position,
    professionalRole,
    professionalTitle,
    status
  } = useDictionaryOptionsSelect({
    category: "md.staff.category",
    gender: "md.staff.gender",
    idType: "md.staff.id_type",
    position: "md.staff.position",
    professionalRole: "md.staff.professional_role",
    professionalTitle: "md.staff.professional_title",
    status: "md.staff.status"
  });

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="number" validators={{ onBlur: z.string("必须").regex(ALPHANUMERIC_PATTERN, "只能包含字母和数字").max(32, "最多32个字符") }}>
          {field => <field.Input required label="工号" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={{ onBlur: z.string("必须").max(32, "最多32个字符") }}>
          {field => <field.Input required label="姓名" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="gender" validators={{ onChange: z.string("必须") }}>
          {field => <field.Select {...gender} required label="性别" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="phoneNumber" validators={{ onBlur: z.string().max(16, "最多16个字符").nullish() }}>
          {field => <field.Input label="手机号码" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="email" validators={{ onBlur: z.string().email("邮箱格式不正确").max(64, "最多64个字符").nullish() }}>
          {field => <field.Input label="邮箱" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="ethnicity" validators={{ onBlur: z.string().max(32, "最多32个字符").nullish() }}>
          {field => <field.Input label="民族" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="birthDate">
          {field => <field.DatePicker label="出生日期" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="idType" validators={{ onChange: z.string().nullish() }}>
          {field => <field.Select {...idType} label="证件类型" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="idNumber" validators={{ onBlur: z.string().regex(ALPHANUMERIC_PATTERN, "只能包含字母和数字").max(32, "最多32个字符").nullish() }}>
          {field => <field.Input label="证件号码" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="category" validators={{ onChange: z.string().nullish() }}>
          {field => <field.Select {...category} label="分类" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="professionalTitle" validators={{ onChange: z.string().nullish() }}>
          {field => <field.Select {...professionalTitle} label="职称" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="position" validators={{ onChange: z.string().nullish() }}>
          {field => <field.Select {...position} label="职务" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="professionalRole" validators={{ onChange: z.string().nullish() }}>
          {field => <field.Select {...professionalRole} label="专业角色" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="status" validators={{ onChange: z.enum(["ON_JOB", "LEAVE", "RETIRE"], "必须") }}>
          {field => <field.Select {...status} required label="状态" />}
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
