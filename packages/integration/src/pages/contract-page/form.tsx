import type { CrudBasicFormScene } from "@vef-framework-react/components";

import type { ContractFormValues } from "./model";

import { Grid, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

import { JSON_SCHEMA_COMPLETIONS } from "./json-schema-completions";

const codeSchema = z.string("请输入契约编码").min(2, "至少 2 个字符").max(64, "最多 64 个字符");
const nameSchema = z.string("请输入契约名称").max(128, "最多 128 个字符");

function validateJsonSchema({ value }: { value: string }): string | undefined {
  if (!value.trim()) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return "不是合法的 JSON";
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return "JSON Schema 必须是一个对象";
  }

  return undefined;
}

export interface ContractFormProps {
  scene: CrudBasicFormScene;
}

/**
 * The create/update form body for a contract.
 */
export function ContractForm({ scene }: ContractFormProps) {
  const { AppField } = useFormContext<ContractFormValues>();
  const isCreate = scene === "create";

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="code" validators={{ onBlur: codeSchema }}>
          {field => <field.Input required disabled={!isCreate} label="契约编码" placeholder="如 order.query" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={{ onBlur: nameSchema }}>
          {field => <field.Input required label="契约名称" placeholder="如 订单查询" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="description">
          {field => <field.TextArea label="描述" placeholder="契约的业务含义与适用场景" rows={2} />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={{ xxs: 24, md: 12 }}>
        <AppField name="inputSchema" validators={{ onChange: validateJsonSchema }}>
          {field => (
            <field.CodeEditor
              showLineNumbers
              completions={JSON_SCHEMA_COMPLETIONS}
              height={260}
              label="输入 Schema（JSON Schema）"
              language="json"
              placeholder="留空则不校验输入"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={{ xxs: 24, md: 12 }}>
        <AppField name="outputSchema" validators={{ onChange: validateJsonSchema }}>
          {field => (
            <field.CodeEditor
              showLineNumbers
              completions={JSON_SCHEMA_COMPLETIONS}
              height={260}
              label="输出 Schema（JSON Schema）"
              language="json"
              placeholder="留空则不校验输出"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="isEnabled">
          {field => <field.Bool label="启用" variant="switch" />}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
