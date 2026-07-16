import type { CollapseItem, CrudBasicFormScene } from "@vef-framework-react/components";

import type { SystemFormValues } from "./model";

import { Collapse, Grid, Stack, Text, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

import { ParamsEditor } from "../../components";
import {
  DATA_SOURCE_MODE_OPTIONS,
  DB_KIND_OPTIONS,
  INBOUND_AUTH_HINTS,
  INBOUND_AUTH_SCHEME_OPTIONS,
  OUTBOUND_AUTH_HINTS,
  OUTBOUND_AUTH_SCHEME_OPTIONS,
  SSL_MODE_OPTIONS

} from "./model";

const codeSchema = z.string("请输入系统编码").min(2, "至少 2 个字符").max(64, "最多 64 个字符");
const nameSchema = z.string("请输入系统名称").max(128, "最多 128 个字符");

function BasicSection({ scene }: { scene: CrudBasicFormScene }) {
  const { AppField } = useFormContext<SystemFormValues>();
  const isCreate = scene === "create";

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <AppField name="code" validators={{ onBlur: codeSchema }}>
          {field => <field.Input required disabled={!isCreate} label="系统编码" placeholder="如 his-east" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={{ onBlur: nameSchema }}>
          {field => <field.Input required label="系统名称" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={16}>
        <AppField name="baseUrl">
          {field => <field.Input label="Base URL" placeholder="https://his.example.com" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={8}>
        <AppField name="timeoutMs">
          {field => <field.InputNumber label="调用超时（ms）" min={0} placeholder="0 用框架默认" style={{ width: "100%" }} />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="params">
          {field => (
            <Stack gap={4}>
              <Text type="secondary">系统参数（非敏感，暴露给脚本 system.params）</Text>
              <ParamsEditor value={field.state.value} onChange={field.handleChange} />
            </Stack>
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="isEnabled">{field => <field.Bool label="启用" variant="switch" />}</AppField>
      </Grid.Item>
    </Grid>
  );
}

function OutboundAuthSection() {
  const form = useFormContext<SystemFormValues>();

  return (
    <Grid columnGap="small">
      <Grid.Item span={12}>
        <form.AppField name="outboundAuth.scheme">
          {field => <field.Select label="认证方式" options={OUTBOUND_AUTH_SCHEME_OPTIONS} />}
        </form.AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.Subscribe selector={state => state.values.outboundAuth.scheme}>
          {scheme => <Text type="secondary">{OUTBOUND_AUTH_HINTS[scheme] ?? "自定义方案，按需填写参数"}</Text>}
        </form.Subscribe>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.Subscribe selector={state => state.values.outboundAuth.scheme}>
          {scheme => scheme === "none"
            ? null
            : (
                <form.AppField name="outboundAuth.params">
                  {field => <ParamsEditor value={field.state.value} onChange={field.handleChange} />}
                </form.AppField>
              )}
        </form.Subscribe>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.Subscribe selector={state => state.values.outboundAuth.scheme}>
          {scheme => scheme === "script"
            ? (
                <form.AppField name="outboundAuth.script">
                  {field => <field.CodeEditor showLineNumbers height={200} label="签名脚本" language="javascript" />}
                </form.AppField>
              )
            : null}
        </form.Subscribe>
      </Grid.Item>
    </Grid>
  );
}

function OutboundEnvelopeSection() {
  const form = useFormContext<SystemFormValues>();

  return (
    <Grid columnGap="small">
      <Grid.Item span={24}>
        <form.AppField name="envelopeEnabled">{field => <field.Bool label="启用出站信封" variant="switch" />}</form.AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.Subscribe selector={state => state.values.envelopeEnabled}>
          {enabled => enabled
            ? (
                <Grid columnGap="small">
                  <Grid.Item span={24}>
                    <Text type="secondary">
                      在系统层统一包裹出站调用的通用结构，适配器只需处理业务数据；需先配置 Base URL，任一侧留空则该侧保持原样。
                    </Text>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.AppField name="envelope.request">
                      {field => <field.CodeEditor showLineNumbers height={180} label="请求包裹脚本（request）" language="javascript" />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.AppField name="envelope.response">
                      {field => <field.CodeEditor showLineNumbers height={180} label="响应解包脚本（response）" language="javascript" />}
                    </form.AppField>
                  </Grid.Item>
                </Grid>
              )
            : <Text type="secondary">未启用：适配器请求原样发送、响应原样返回。</Text>}
        </form.Subscribe>
      </Grid.Item>
    </Grid>
  );
}

function InboundAuthSection() {
  const form = useFormContext<SystemFormValues>();

  return (
    <Grid columnGap="small">
      <Grid.Item span={24}>
        <form.AppField name="inboundEnabled">{field => <field.Bool label="开放入站" variant="switch" />}</form.AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.Subscribe selector={state => state.values.inboundEnabled}>
          {enabled => enabled
            ? (
                <Grid columnGap="small">
                  <Grid.Item span={12}>
                    <form.AppField name="inboundAuth.scheme">
                      {field => <field.Select label="入站认证方式" options={INBOUND_AUTH_SCHEME_OPTIONS} />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.Subscribe selector={state => state.values.inboundAuth.scheme}>
                      {scheme => <Text type="secondary">{INBOUND_AUTH_HINTS[scheme] ?? "自定义方案，按需填写参数"}</Text>}
                    </form.Subscribe>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.Subscribe selector={state => state.values.inboundAuth.scheme}>
                      {scheme => scheme === "none"
                        ? null
                        : (
                            <form.AppField name="inboundAuth.params">
                              {field => <ParamsEditor value={field.state.value} onChange={field.handleChange} />}
                            </form.AppField>
                          )}
                    </form.Subscribe>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.Subscribe selector={state => state.values.inboundAuth.scheme}>
                      {scheme => scheme === "script"
                        ? (
                            <form.AppField name="inboundAuth.script">
                              {field => <field.CodeEditor showLineNumbers height={200} label="验证脚本" language="javascript" />}
                            </form.AppField>
                          )
                        : null}
                    </form.Subscribe>
                  </Grid.Item>
                </Grid>
              )
            : <Text type="secondary">未开放入站：任何外部系统的回调都会被拒绝。</Text>}
        </form.Subscribe>
      </Grid.Item>
    </Grid>
  );
}

function DataSourceSection() {
  const form = useFormContext<SystemFormValues>();

  return (
    <Grid columnGap="small">
      <Grid.Item span={24}>
        <form.AppField name="dataSourceEnabled">{field => <field.Bool label="启用直连数据源" variant="switch" />}</form.AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.Subscribe selector={state => state.values.dataSourceEnabled}>
          {enabled => enabled
            ? (
                <Grid columnGap="small">
                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.kind">
                      {field => <field.Select label="数据库类型" options={DB_KIND_OPTIONS} />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.mode">
                      {field => <field.Select label="脚本访问模式" options={DATA_SOURCE_MODE_OPTIONS} />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.sslMode">
                      {field => <field.Select label="SSL 模式" options={SSL_MODE_OPTIONS} />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.Subscribe selector={state => state.values.dataSource.mode}>
                      {mode => (
                        <Text type={mode === "read_write" ? "warning" : "secondary"}>
                          {mode === "read_write"
                            ? "读写模式：脚本可用 sql.exec 写入该库，请仅对可信的交换库开启。"
                            : "只读模式：脚本仅能用 sql.query 读取该库。"}
                        </Text>
                      )}
                    </form.Subscribe>
                  </Grid.Item>

                  <Grid.Item span={16}>
                    <form.AppField name="dataSource.host">{field => <field.Input label="Host" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.port">
                      {field => <field.InputNumber label="端口" max={65_535} min={0} style={{ width: "100%" }} />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.user">{field => <field.Input label="用户名" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.password">{field => <field.Password label="密码" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.database">{field => <field.Input label="数据库" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.schema">{field => <field.Input label="Schema" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.path">{field => <field.Input label="Path（SQLite）" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.AppField name="dataSource.sslRootCert">{field => <field.TextArea label="SSL 根证书" rows={2} />}</form.AppField>
                  </Grid.Item>
                </Grid>
              )
            : null}
        </form.Subscribe>
      </Grid.Item>
    </Grid>
  );
}

function RetrySection() {
  const form = useFormContext<SystemFormValues>();

  return (
    <Grid columnGap="small">
      <Grid.Item span={24}>
        <form.AppField name="retryEnabled">{field => <field.Bool label="启用重试" variant="switch" />}</form.AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <form.Subscribe selector={state => state.values.retryEnabled}>
          {enabled => enabled
            ? (
                <Grid columnGap="small">
                  <Grid.Item span={8}>
                    <form.AppField name="retry.maxAttempts">
                      {field => <field.InputNumber label="最大次数" min={1} style={{ width: "100%" }} />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="retry.initialBackoffMs">
                      {field => <field.InputNumber label="初始退避（ms）" min={0} style={{ width: "100%" }} />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="retry.maxBackoffMs">
                      {field => <field.InputNumber label="最大退避（ms）" min={0} style={{ width: "100%" }} />}
                    </form.AppField>
                  </Grid.Item>
                </Grid>
              )
            : null}
        </form.Subscribe>
      </Grid.Item>
    </Grid>
  );
}

export interface SystemFormProps {
  scene: CrudBasicFormScene;
}

/**
 * The create/update form body for a system, organized into collapsible sections.
 */
export function SystemForm({ scene }: SystemFormProps) {
  const items: CollapseItem[] = [
    {
      key: "basic",
      label: "基础信息",
      children: <BasicSection scene={scene} />
    },
    {
      key: "auth",
      label: "出站认证",
      children: <OutboundAuthSection />
    },
    {
      key: "envelope",
      label: "出站信封",
      children: <OutboundEnvelopeSection />
    },
    {
      key: "inbound",
      label: "入站认证",
      children: <InboundAuthSection />
    },
    {
      key: "dataSource",
      label: "直连数据源",
      children: <DataSourceSection />
    },
    {
      key: "retry",
      label: "重试策略",
      children: <RetrySection />
    }
  ];

  return <Collapse defaultActiveKey={["basic", "auth"]} items={items} />;
}
