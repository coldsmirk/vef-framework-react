import type { CrudBasicFormScene } from "@vef-framework-react/components";

import type { AdapterParams, Direction } from "../../types";

import { Grid, Segmented, Stack, Text, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

import { DIRECTION_OPTIONS, ScriptBindingHints, useContractDirectory, useSystemDirectory } from "../../components";

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
          {field => <field.Select required disabled={!isCreate} label="所属系统" loading={systemDir.loading} options={systemDir.options} />}
        </form.AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <form.AppField name="contractId" validators={{ onChange: requiredId("请选择所属契约") }}>
          {field => <field.Select required disabled={!isCreate} label="所属契约" loading={contractDir.loading} options={contractDir.options} />}
        </form.AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <form.AppField name="direction">
          {field => (
            <Stack gap={4}>
              <Text type="secondary">方向</Text>

              <Segmented<Direction>
                disabled={!isCreate}
                options={DIRECTION_OPTIONS}
                value={field.state.value ?? "outbound"}
                onChange={field.handleChange}
              />
            </Stack>
          )}
        </form.AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <form.AppField name="timeoutMs">
          {field => <field.InputNumber label="超时覆盖（ms）" min={0} placeholder="0 用框架默认" style={{ width: "100%" }} />}
        </form.AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.Subscribe selector={state => state.values.direction ?? "outbound"}>
          {direction => <ScriptBindingHints direction={direction} />}
        </form.Subscribe>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.AppField name="script" validators={{ onChange: scriptSchema }}>
          {field => (
            <field.CodeEditor
              required
              showFoldGutter
              showLineNumbers
              height={360}
              label="脚本"
              language="javascript"
            />
          )}
        </form.AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.AppField name="isEnabled">{field => <field.Bool label="启用" variant="switch" />}</form.AppField>
      </Grid.Item>
    </Grid>
  );
}
