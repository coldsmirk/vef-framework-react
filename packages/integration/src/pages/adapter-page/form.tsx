import type { CrudBasicFormScene } from "@vef-framework-react/components";

import type { AdapterParams } from "../../types";

import { Grid, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

import { adapterScriptDoc, DIRECTION_OPTIONS, ScriptDocLabel, useContractDirectory, useSystemDirectory } from "../../components";

function requiredId(message: string) {
  return z.string(message).min(1, message);
}

const scriptSchema = z.string("请输入脚本").min(1, "请输入脚本");

export interface AdapterFormProps {
  scene: CrudBasicFormScene;
}

/**
 * The create/update form body for an adapter: identity plus the translation script.
 */
export function AdapterForm({ scene }: AdapterFormProps) {
  const form = useFormContext<AdapterParams>();
  const systemDir = useSystemDirectory();
  const contractDir = useContractDirectory();
  const isCreate = scene === "create";

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <form.AppField name="systemId" validators={{ onChange: requiredId("请选择所属系统") }}>
          {field => (
            <field.Select
              required
              disabled={!isCreate}
              label="所属系统"
              loading={systemDir.loading}
              options={systemDir.options}
              placeholder="适配器对接的外部系统"
            />
          )}
        </form.AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <form.AppField name="contractId" validators={{ onChange: requiredId("请选择所属契约") }}>
          {field => (
            <field.Select
              required
              disabled={!isCreate}
              label="所属契约"
              loading={contractDir.loading}
              options={contractDir.options}
              placeholder="适配器实现的标准契约"
            />
          )}
        </form.AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <form.AppField name="direction">
          {field => (
            <field.Radio
              buttonStyle="solid"
              disabled={!isCreate}
              label="方向"
              options={DIRECTION_OPTIONS}
              optionType="button"
            />
          )}
        </form.AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <form.AppField name="timeoutMs">
          {field => <field.InputNumber extra="0 表示使用框架默认的运行超时" label="超时覆盖（ms）" min={0} style={{ width: "100%" }} />}
        </form.AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.Subscribe selector={state => state.values.direction ?? "outbound"}>
          {direction => (
            <form.AppField name="script" validators={{ onChange: scriptSchema }}>
              {field => (
                <field.CodeEditor
                  required
                  showLineNumbers
                  completions={adapterScriptDoc(direction).entries}
                  height={420}
                  label={<ScriptDocLabel doc={adapterScriptDoc(direction)} label="脚本" />}
                  language="javascript"
                  placeholder="// 参照上方的绑定说明编写，return 即本次调用的返回值"
                  size="large"
                />
              )}
            </form.AppField>
          )}
        </form.Subscribe>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.AppField name="isEnabled">{field => <field.Bool label="启用" variant="switch" />}</form.AppField>
      </Grid.Item>
    </Grid>
  );
}
