import type { RouteParams } from "../../types";

import { Grid, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

import { useContractDirectory, useSystemDirectory } from "../../components";

const systemSchema = z.string("请选择目标系统").min(1, "请选择目标系统");
const WILDCARD_CONTRACT = { label: "全部契约（通配）", value: "" };

/**
 * The create/update form body for a route.
 */
export function RouteForm() {
  const { AppField } = useFormContext<RouteParams>();
  const systemDir = useSystemDirectory();
  const contractDir = useContractDirectory();
  const contractOptions = [WILDCARD_CONTRACT, ...contractDir.options];

  return (
    <Grid columnGap="small">
      <Grid.Item span={24}>
        <AppField name="routeKey">
          {field => (
            <field.Input
              extra="业务调用时携带的分流标识；留空即默认路由，未指定路由键的调用都会命中它"
              label="路由键"
              placeholder="如 hospital-east"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="contractId">
          {field => (
            <field.Select
              extra="同一路由键下，精确契约优先于「全部契约（通配）」"
              label="契约范围"
              loading={contractDir.loading}
              options={contractOptions}
              placeholder="选择契约，或全部契约（通配）"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="systemId" validators={{ onChange: systemSchema }}>
          {field => <field.Select required label="目标系统" loading={systemDir.loading} options={systemDir.options} placeholder="选择目标系统" />}
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
