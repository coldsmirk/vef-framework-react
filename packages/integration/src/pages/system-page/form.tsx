import type { CrudBasicFormScene } from "@vef-framework-react/components";

import type { SystemFormValues } from "./model";

import { globalCssVars, Grid, Stack, Text, useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

import {
  AuthParamsFields,
  ENVELOPE_REQUEST_SCRIPT_COMPLETIONS,
  ENVELOPE_RESPONSE_SCRIPT_COMPLETIONS,
  FormSection,
  INBOUND_AUTH_SCRIPT_COMPLETIONS,
  Labeled,
  OUTBOUND_AUTH_SCRIPT_COMPLETIONS,
  ParamsEditor
} from "../../components";
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
    <FormSection description="系统的标识、访问入口与公共参数" title="基础信息">
      <Grid columnGap="small">
        <Grid.Item span={12}>
          <AppField name="code" validators={{ onBlur: codeSchema }}>
            {field => <field.Input required disabled={!isCreate} label="系统编码" placeholder="如 his-east" />}
          </AppField>
        </Grid.Item>

        <Grid.Item span={12}>
          <AppField name="name" validators={{ onBlur: nameSchema }}>
            {field => <field.Input required label="系统名称" placeholder="如 东区 HIS" />}
          </AppField>
        </Grid.Item>

        <Grid.Item span={16}>
          <AppField name="baseUrl">
            {field => <field.Input label="Base URL" placeholder="https://his.example.com" />}
          </AppField>
        </Grid.Item>

        <Grid.Item span={8}>
          <AppField name="timeoutMs">
            {field => <field.InputNumber extra="0 表示使用框架默认" label="调用超时（ms）" min={0} style={{ width: "100%" }} />}
          </AppField>
        </Grid.Item>

        <Grid.Item span={24}>
          <AppField name="params">
            {field => (
              <Labeled hint="非敏感，脚本可通过 system.params 读取" label="系统参数">
                <ParamsEditor namePlaceholder="如 branchCode" value={field.state.value} onChange={field.handleChange} />
              </Labeled>
            )}
          </AppField>
        </Grid.Item>

        <Grid.Item span={24}>
          <AppField name="isEnabled">{field => <field.Bool label="启用" variant="switch" />}</AppField>
        </Grid.Item>
      </Grid>
    </FormSection>
  );
}

function OutboundAuthSection() {
  const form = useFormContext<SystemFormValues>();

  return (
    <FormSection description="调用该系统时如何携带凭证" title="出站认证">
      <Grid columnGap="small">
        <Grid.Item span={12}>
          <form.AppField name="outboundAuth.scheme">
            {field => (
              <field.Select
                extra={OUTBOUND_AUTH_HINTS[field.state.value] ?? "自定义方案，按需填写参数"}
                label="认证方式"
                options={OUTBOUND_AUTH_SCHEME_OPTIONS}
              />
            )}
          </form.AppField>
        </Grid.Item>

        <Grid.Item span={24}>
          <form.Subscribe selector={state => state.values.outboundAuth.scheme}>
            {scheme => (
              <form.AppField name="outboundAuth.params">
                {field => (
                  <AuthParamsFields
                    direction="outbound"
                    scheme={scheme}
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.AppField>
            )}
          </form.Subscribe>
        </Grid.Item>

        <Grid.Item span={24}>
          <form.Subscribe selector={state => state.values.outboundAuth.scheme}>
            {scheme => scheme === "script"
              ? (
                  <form.AppField name="outboundAuth.script">
                    {field => (
                      <field.CodeEditor
                        showLineNumbers
                        completions={OUTBOUND_AUTH_SCRIPT_COMPLETIONS}
                        height={200}
                        label="签名脚本"
                        language="javascript"
                        placeholder="// 读取 request 与 params，返回需追加的凭据请求头对象"
                      />
                    )}
                  </form.AppField>
                )
              : null}
          </form.Subscribe>
        </Grid.Item>
      </Grid>
    </FormSection>
  );
}

function EnabledSwitch({ name }: { name: "envelopeEnabled" | "inboundEnabled" | "dataSourceEnabled" | "retryEnabled" }) {
  const form = useFormContext<SystemFormValues>();

  return (
    <form.AppField name={name}>
      {field => <field.Bool noWrapper variant="switch" />}
    </form.AppField>
  );
}

function OutboundEnvelopeSection() {
  const form = useFormContext<SystemFormValues>();

  return (
    <form.Subscribe selector={state => state.values.envelopeEnabled}>
      {enabled => (
        <FormSection
          description="在系统层统一包裹每次出站调用的通用报文结构，适配器只处理业务数据；需先配置 Base URL"
          extra={<EnabledSwitch name="envelopeEnabled" />}
          title="出站信封"
        >
          {enabled
            ? (
                <Grid columnGap="small">
                  <Grid.Item span={24}>
                    <form.AppField name="envelope.request">
                      {field => (
                        <field.CodeEditor
                          showLineNumbers
                          completions={ENVELOPE_REQUEST_SCRIPT_COMPLETIONS}
                          extra="留空则请求原样发送"
                          height={180}
                          label="请求包裹脚本（request）"
                          language="javascript"
                          placeholder="// 读取 request，返回改写后的 { method, path, headers, query, body }"
                        />
                      )}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.AppField name="envelope.response">
                      {field => (
                        <field.CodeEditor
                          showLineNumbers
                          completions={ENVELOPE_RESPONSE_SCRIPT_COMPLETIONS}
                          extra="留空则响应原样返回"
                          height={180}
                          label="响应解包脚本（response）"
                          language="javascript"
                          placeholder="// 读取 response，返回解包后的业务数据作为调用结果"
                        />
                      )}
                    </form.AppField>
                  </Grid.Item>
                </Grid>
              )
            : null}
        </FormSection>
      )}
    </form.Subscribe>
  );
}

function InboundSection() {
  const form = useFormContext<SystemFormValues>();

  return (
    <form.Subscribe selector={state => state.values.inboundEnabled}>
      {enabled => (
        <FormSection
          description="开放后该系统可通过入站网关投递请求；关闭时一切回调都会被拒绝"
          extra={<EnabledSwitch name="inboundEnabled" />}
          title="入站回调"
        >
          {enabled
            ? (
                <Grid columnGap="small">
                  <Grid.Item span={12}>
                    <form.AppField name="inboundAuth.scheme">
                      {field => (
                        <field.Select
                          extra={INBOUND_AUTH_HINTS[field.state.value] ?? "自定义方案，按需填写参数"}
                          label="验证方式"
                          options={INBOUND_AUTH_SCHEME_OPTIONS}
                        />
                      )}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.Subscribe selector={state => state.values.inboundAuth.scheme}>
                      {scheme => (
                        <form.AppField name="inboundAuth.params">
                          {field => (
                            <AuthParamsFields
                              direction="inbound"
                              scheme={scheme}
                              value={field.state.value}
                              onChange={field.handleChange}
                            />
                          )}
                        </form.AppField>
                      )}
                    </form.Subscribe>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.Subscribe selector={state => state.values.inboundAuth.scheme}>
                      {scheme => scheme === "script"
                        ? (
                            <form.AppField name="inboundAuth.script">
                              {field => (
                                <field.CodeEditor
                                  showLineNumbers
                                  completions={INBOUND_AUTH_SCRIPT_COMPLETIONS}
                                  height={200}
                                  label="验证脚本"
                                  language="javascript"
                                  placeholder="// 读取 request 与 params，返回真值即放行"
                                />
                              )}
                            </form.AppField>
                          )
                        : null}
                    </form.Subscribe>
                  </Grid.Item>
                </Grid>
              )
            : null}
        </FormSection>
      )}
    </form.Subscribe>
  );
}

function DataSourceSection() {
  const form = useFormContext<SystemFormValues>();

  return (
    <form.Subscribe selector={state => state.values.dataSourceEnabled}>
      {enabled => (
        <FormSection
          description="为该系统的适配器脚本提供 sql 能力的直连数据库"
          extra={<EnabledSwitch name="dataSourceEnabled" />}
          title="直连数据源"
        >
          {enabled
            ? (
                <Grid columnGap="small">
                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.kind">
                      {field => <field.Select label="数据库类型" options={DB_KIND_OPTIONS} />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.mode">
                      {field => (
                        <field.Select
                          label="脚本访问模式"
                          options={DATA_SOURCE_MODE_OPTIONS}
                          extra={field.state.value === "read_write"
                            ? (
                                <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="warning">
                                  脚本可用 sql.exec 写入该库，仅对可信的交换库开启
                                </Text>
                              )
                            : undefined}
                        />
                      )}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.sslMode">
                      {field => <field.Select label="SSL 模式" options={SSL_MODE_OPTIONS} />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={16}>
                    <form.AppField name="dataSource.host">{field => <field.Input label="Host" placeholder="如 192.168.1.10" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.port">
                      {field => <field.InputNumber label="端口" max={65_535} min={0} style={{ width: "100%" }} />}
                    </form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.user">{field => <field.Input label="用户名" placeholder="如 exchange_ro" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.password">{field => <field.Password label="密码" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={8}>
                    <form.AppField name="dataSource.database">{field => <field.Input label="数据库" placeholder="如 his_exchange" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={12}>
                    <form.AppField name="dataSource.schema">{field => <field.Input label="Schema" placeholder="如 public" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={12}>
                    <form.AppField name="dataSource.path">{field => <field.Input label="Path（SQLite）" placeholder="如 /data/exchange.db" />}</form.AppField>
                  </Grid.Item>

                  <Grid.Item span={24}>
                    <form.AppField name="dataSource.sslRootCert">{field => <field.TextArea label="SSL 根证书" placeholder="PEM 格式证书内容" rows={2} />}</form.AppField>
                  </Grid.Item>
                </Grid>
              )
            : null}
        </FormSection>
      )}
    </form.Subscribe>
  );
}

function RetrySection() {
  const form = useFormContext<SystemFormValues>();

  return (
    <form.Subscribe selector={state => state.values.retryEnabled}>
      {enabled => (
        <FormSection
          description="出站调用失败后的自动重试"
          extra={<EnabledSwitch name="retryEnabled" />}
          title="重试策略"
        >
          {enabled
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
        </FormSection>
      )}
    </form.Subscribe>
  );
}

export interface SystemFormProps {
  scene: CrudBasicFormScene;
}

/**
 * The create/update form body for a system: always-on basics and outbound
 * auth, then the optional capabilities, each toggled from its section header.
 */
export function SystemForm({ scene }: SystemFormProps) {
  return (
    <Stack gap="middle">
      <BasicSection scene={scene} />
      <OutboundAuthSection />
      <OutboundEnvelopeSection />
      <InboundSection />
      <DataSourceSection />
      <RetrySection />
    </Stack>
  );
}
