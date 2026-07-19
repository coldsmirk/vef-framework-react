import type { ConcurrencyPolicy, MisfirePolicy } from "../../types";
import type { ScheduleFormValues } from "./model";

import { Flex, globalCssVars, Grid, Labeled, Stack, Text, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

import {
  CONCURRENCY_POLICY_OPTIONS,
  isTriggerComplete,
  MISFIRE_POLICY_OPTIONS,
  TriggerEditor
} from "../../components";
import { useJobNames } from "./helpers";
import { jsonParamsError, TIMEOUT_UNIT_OPTIONS } from "./model";

const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

const nameSchema = z.string("请输入调度名称").min(1, "请输入调度名称").max(128, "最多 128 个字符");
const jobSchema = z.string("请选择任务处理器").min(1, "请选择任务处理器");

const MISFIRE_HINTS: Record<MisfirePolicy, string> = {
  fire_now: "错过后立即补跑一次",
  skip: "跳过错过的触发"
};

const CONCURRENCY_HINTS: Record<ConcurrencyPolicy, string> = {
  forbid: "上次未结束则跳过",
  allow: "允许并行"
};

/**
 * The create/update form body for a schedule.
 */
export function ScheduleForm() {
  const form = useFormContext<ScheduleFormValues>();
  const jobs = useJobNames();

  return (
    <Stack gap="middle">
      <Grid columnGap="small">
        <Grid.Item span={12}>
          <form.AppField name="name" validators={{ onBlur: nameSchema }}>
            {field => <field.Input required extra="唯一标识；编辑时修改即为重命名" label="名称" placeholder="如 nightly-sync" />}
          </form.AppField>
        </Grid.Item>

        <Grid.Item span={12}>
          <form.AppField name="jobName" validators={{ onChange: jobSchema }}>
            {field => (
              <field.Select
                required
                showSearch
                label="任务处理器"
                loading={jobs.loading}
                options={jobs.options}
                placeholder="选择已注册的任务处理器"
              />
            )}
          </form.AppField>
        </Grid.Item>

        <Grid.Item span={24}>
          <form.Subscribe selector={state => { return { startsAt: state.values.startsAt, endsAt: state.values.endsAt }; }}>
            {({ startsAt, endsAt }) => (
              <form.AppField name="trigger" validators={{ onChange: ({ value }) => isTriggerComplete(value) ? undefined : "请完善触发配置" }}>
                {field => (
                  <Labeled required label="触发规则">
                    <TriggerEditor endsAt={endsAt} startsAt={startsAt} value={field.state.value} onChange={field.handleChange} />

                    {field.state.meta.isTouched && !isTriggerComplete(field.state.value)
                      ? <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="danger">请完善触发配置后再保存</Text>
                      : null}
                  </Labeled>
                )}
              </form.AppField>
            )}
          </form.Subscribe>
        </Grid.Item>

        <Grid.Item span={12}>
          <form.AppField name="startsAt">
            {field => <field.DatePicker showTime format={DATE_TIME_FORMAT} label="生效开始" placeholder="留空则立即生效" />}
          </form.AppField>
        </Grid.Item>

        <Grid.Item span={12}>
          <form.AppField name="endsAt">
            {field => <field.DatePicker showTime format={DATE_TIME_FORMAT} label="生效结束" placeholder="留空则长期有效" />}
          </form.AppField>
        </Grid.Item>

        <Grid.Item span={12}>
          <form.AppField name="misfirePolicy">
            {field => <field.Select extra={MISFIRE_HINTS[field.state.value]} label="错过策略" options={MISFIRE_POLICY_OPTIONS} />}
          </form.AppField>
        </Grid.Item>

        <Grid.Item span={12}>
          <form.AppField name="concurrencyPolicy">
            {field => <field.Select extra={CONCURRENCY_HINTS[field.state.value]} label="并发策略" options={CONCURRENCY_POLICY_OPTIONS} />}
          </form.AppField>
        </Grid.Item>

        <Grid.Item span={12}>
          <Labeled hint="0 表示使用全局默认" label="执行超时">
            <Flex gap="small">
              <form.AppField name="timeoutValue">
                {field => <field.InputNumber noWrapper min={0} style={{ flex: 1 }} />}
              </form.AppField>

              <form.AppField name="timeoutUnit">
                {field => <field.Select noWrapper options={TIMEOUT_UNIT_OPTIONS} style={{ width: 100 }} />}
              </form.AppField>
            </Flex>
          </Labeled>
        </Grid.Item>

        <Grid.Item span={12}>
          <form.AppField name="recover">
            {field => <field.Bool extra="节点崩溃后重新触发，处理器需保证幂等" label="崩溃恢复" variant="switch" />}
          </form.AppField>
        </Grid.Item>

        <Grid.Item span={24}>
          <form.AppField name="paramsText" validators={{ onChange: ({ value }) => jsonParamsError(value) }}>
            {field => (
              <field.CodeEditor
                showLineNumbers
                extra="JSON 对象，留空表示无参数"
                height={140}
                label="任务参数"
                language="json"
                placeholder={"如 { \"batchSize\": 100 }"}
              />
            )}
          </form.AppField>
        </Grid.Item>

        <Grid.Item span={24}>
          <form.AppField name="enabled">
            {field => <field.Bool label="启用" variant="switch" />}
          </form.AppField>
        </Grid.Item>
      </Grid>
    </Stack>
  );
}
