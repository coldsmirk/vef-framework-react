import type { CrudBasicFormScene } from "@vef-framework-react/components";

import type { CodeMapEntry } from "../../types";
import type { CodeMapFormValues } from "./model";

import { Grid, Labeled, Text, useFormContext } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { z } from "@vef-framework-react/shared";
import { useMemo } from "react";

import { useCodeSetApi } from "../../api";
import { useSystemDirectory } from "../../components";
import { CodeMapEntriesEditor } from "./entries-editor";
import { CODE_SET_PATTERN, validateCodeMapEntries } from "./model";

const systemSchema = z.string("请选择所属系统").min(1, "请选择所属系统");
const codeSetSchema = z
  .string("请输入码集标识")
  .min(1, "请输入码集标识")
  .max(128, "最多 128 个字符")
  .regex(CODE_SET_PATTERN, "以字母或数字开头结尾，中间可含 _ . -");
const nameSchema = z.string("请输入码表名称").min(1, "请输入码表名称").max(128, "最多 128 个字符");

function validateEntries({ value }: { value: CodeMapEntry[] }): string | undefined {
  const issues = validateCodeMapEntries(value);

  return issues.length > 0 ? issues.join("；") : undefined;
}

function validateFallback({ value }: { value: string }): string | undefined {
  return value.trim() ? undefined : "兜底策略需要填写该值";
}

const POLICY_OPTIONS = [
  { label: "未收录报错（默认，缺映射即失败）", value: "reject" },
  { label: "透传原值", value: "passthrough" },
  { label: "返回兜底值", value: "fallback" }
];

// The host-catalog reference line under the entries editor: the canonical
// codes (with labels) of the currently selected code set, when the host
// registered an enumerable catalog.
function HostCodesHint({ codeSet, supported }: { codeSet: string; supported: boolean }) {
  const api = useCodeSetApi();
  const enabled = supported && codeSet.length > 0;
  const { data } = useQuery({
    enabled,
    queryFn: api.listCodes,
    queryKey: [api.listCodes.key, { codeSet }]
  });

  if (!enabled || !data?.supported || !data.codes?.length) {
    return null;
  }

  return (
    <Text type="secondary">
      标准值参考：
      {data.codes.map(code => `${code.code} = ${code.label}`).join("，")}
    </Text>
  );
}

export interface CodeMapFormProps {
  scene: CrudBasicFormScene;
}

/**
 * The create/update form body for a code map.
 */
export function CodeMapForm({ scene }: CodeMapFormProps) {
  const form = useFormContext<CodeMapFormValues>();
  const { AppField } = form;
  const systemDir = useSystemDirectory();
  const api = useCodeSetApi();
  const {
    data: catalog,
    isError: isCatalogError,
    isLoading: isCatalogLoading
  } = useQuery({ queryFn: api.listCodeSets, queryKey: [api.listCodeSets.key, {}] });
  const isCreate = scene === "create";
  const supported = catalog?.supported === true;

  const codeSetOptions = useMemo(
    () => (catalog?.codeSets ?? []).map(info => { return { label: `${info.name}（${info.codeSet}）`, value: info.codeSet }; }),
    [catalog]
  );

  return (
    <Grid columnGap="small">
      <Grid.Item span={24}>
        <AppField name="systemId" validators={{ onChange: systemSchema }}>
          {field => (
            <field.Select
              required
              disabled={!isCreate}
              label="所属系统"
              loading={systemDir.loading}
              options={systemDir.options}
              placeholder="选择外部系统"
            />
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="codeSet" validators={{ onChange: codeSetSchema }}>
          {field => !isCreate || catalog?.supported === false
            ? (
                <field.Input
                  required
                  disabled={!isCreate}
                  extra="适配器脚本以 codes.toExternal('<码集>', …) 引用"
                  label="码集标识"
                  placeholder="如 gender"
                />
              )
            : (
                <field.Select
                  required
                  disabled={isCatalogLoading || isCatalogError}
                  label="标准码集"
                  loading={isCatalogLoading}
                  options={codeSetOptions}
                  status={isCatalogError ? "error" : undefined}
                  extra={isCatalogError
                    ? "标准码集加载失败，请稍后重试"
                    : "从本系统已注册的标准码集中选择，自动填充码表名称"}
                  placeholder={isCatalogLoading
                    ? "正在加载标准码集…"
                    : isCatalogError
                      ? "标准码集加载失败"
                      : codeSetOptions.length === 0
                        ? "暂无可用标准码集"
                        : "选择标准码集"}
                  onSelect={codeSet => {
                    const info = catalog?.codeSets?.find(entry => entry.codeSet === codeSet);

                    if (info) {
                      form.setFieldValue("name", info.name);
                    }
                  }}
                />
              )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={12}>
        <AppField name="name" validators={{ onChange: nameSchema }}>
          {field => <field.Input required label="码表名称" placeholder="如 性别" />}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="entries" validators={{ onChange: validateEntries }}>
          {field => (
            <Labeled
              hint={"别名仅参与匹配，转换输出始终为主值；数字与 true/false 按 JSON 类型存储，需存为字面量字符串时加英文引号（如 \"1\"）"}
              label="映射条目"
            >
              <CodeMapEntriesEditor value={field.state.value} onChange={field.handleChange} />
              {field.state.meta.errors.length > 0 && <Text type="danger">{String(field.state.meta.errors[0])}</Text>}

              <form.Subscribe selector={state => state.values.codeSet}>
                {codeSet => <HostCodesHint codeSet={codeSet} supported={supported} />}
              </form.Subscribe>
            </Labeled>
          )}
        </AppField>
      </Grid.Item>

      <Grid.Item span={24}>
        <AppField name="onUnmapped">
          {field => (
            <field.Select
              required
              extra="脚本可通过 { fallback: … } / { passthrough: true } / { reject: true } 按调用覆盖"
              label="未收录策略"
              options={POLICY_OPTIONS}
            />
          )}
        </AppField>
      </Grid.Item>

      <form.Subscribe selector={state => state.values.onUnmapped}>
        {policy => policy === "fallback"
          ? (
              <>
                <Grid.Item span={12}>
                  <AppField name="fallbackCanonical" validators={{ onChange: validateFallback }}>
                    {field => <field.Input required extra="toCanonical 未命中时返回的标准侧值" label="标准侧兜底值" placeholder="如 0" />}
                  </AppField>
                </Grid.Item>

                <Grid.Item span={12}>
                  <AppField name="fallbackExternal" validators={{ onChange: validateFallback }}>
                    {field => <field.Input required extra="toExternal 未命中时返回的外部侧值" label="外部侧兜底值" placeholder="如 U" />}
                  </AppField>
                </Grid.Item>
              </>
            )
          : null}
      </form.Subscribe>

      <Grid.Item span={24}>
        <AppField name="isEnabled">
          {field => <field.Bool label="启用" variant="switch" />}
        </AppField>
      </Grid.Item>
    </Grid>
  );
}
