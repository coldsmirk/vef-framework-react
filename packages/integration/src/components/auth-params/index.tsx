import type { Direction } from "../../types";

import { globalCssVars, Grid, Input, Labeled, Stack, Text } from "@vef-framework-react/components";

import { ParamsEditor } from "../params-editor";

/**
 * One dedicated input of a fixed-parameter auth scheme.
 */
export interface AuthParamFieldSpec {
  /**
   * The key written into the auth config's params record.
   */
  name: string;
  /**
   * The input label.
   */
  label: string;
  /**
   * Concise format hint shown while the input is empty.
   */
  placeholder?: string;
  /**
   * Secondary line rendered under the input.
   */
  hint?: string;
  /**
   * Encrypted at rest; the management API masks it back as `******`.
   */
  sensitive?: boolean;
  /**
   * Render a textarea with this many rows instead of a single-line input.
   */
  rows?: number;
  /**
   * Grid span out of 24, defaults to 12.
   */
  span?: number;
}

/**
 * How a scheme's parameters are edited: no parameters at all, a dedicated
 * input per declared parameter, or a free name → value pair list for schemes
 * whose parameter names are user-defined.
 */
export type AuthParamsSpec
  = | { kind: "none" }
    | { kind: "fixed"; fields: AuthParamFieldSpec[] }
    | {
      kind: "pairs";
      label: string;
      hint?: string;
      namePlaceholder?: string;
      valuePlaceholder?: string;
    };

const USERNAME_FIELD: AuthParamFieldSpec = {
  name: "username",
  label: "用户名",
  placeholder: "如 api_user"
};

const PASSWORD_FIELD: AuthParamFieldSpec = {
  name: "password",
  label: "密码",
  sensitive: true
};

/**
 * The built-in outbound schemes' parameter shapes, keyed by scheme name.
 * Mirrors `internal/integration/auth/outbound_schemes.go`.
 */
const OUTBOUND_PARAM_SPECS: Record<string, AuthParamsSpec> = {
  none: { kind: "none" },
  http_basic: {
    kind: "fixed",
    fields: [USERNAME_FIELD, PASSWORD_FIELD]
  },
  bearer: {
    kind: "fixed",
    fields: [
      {
        name: "token",
        label: "Token",
        placeholder: "外部系统颁发的访问令牌",
        sensitive: true,
        span: 24
      }
    ]
  },
  signature: {
    kind: "fixed",
    fields: [
      {
        name: "appId",
        label: "App ID",
        placeholder: "双方约定的应用标识"
      },
      {
        name: "secret",
        label: "Secret",
        placeholder: "十六进制 HMAC 密钥",
        sensitive: true
      }
    ]
  },
  header: {
    kind: "pairs",
    label: "凭据请求头",
    hint: "随每次出站请求附加，可配置多组；值加密存储",
    namePlaceholder: "Header 名，如 X-Api-Key",
    valuePlaceholder: "凭据值"
  },
  query: {
    kind: "pairs",
    label: "凭据查询参数",
    hint: "随每次出站请求附加，可配置多组；值加密存储",
    namePlaceholder: "参数名，如 api_key",
    valuePlaceholder: "凭据值"
  },
  script: {
    kind: "pairs",
    label: "签名参数",
    hint: "脚本内通过 params.<参数名> 读取；值加密存储",
    namePlaceholder: "参数名",
    valuePlaceholder: "参数值"
  }
};

/**
 * The built-in inbound schemes' parameter shapes, keyed by scheme name.
 * Mirrors `internal/integration/auth/inbound_schemes.go`.
 */
const INBOUND_PARAM_SPECS: Record<string, AuthParamsSpec> = {
  none: { kind: "none" },
  ip: {
    kind: "fixed",
    fields: [
      {
        name: "whitelist",
        label: "IP 白名单",
        placeholder: "如 10.0.0.0/8, 192.168.1.15",
        hint: "逗号分隔的 IP 或 CIDR",
        rows: 2,
        span: 24
      }
    ]
  },
  http_basic: {
    kind: "fixed",
    fields: [USERNAME_FIELD, PASSWORD_FIELD]
  },
  bearer: {
    kind: "fixed",
    fields: [
      {
        name: "token",
        label: "Token",
        placeholder: "要求调用方携带的访问令牌",
        sensitive: true,
        span: 24
      }
    ]
  },
  signature: {
    kind: "fixed",
    fields: [
      {
        name: "secret",
        label: "Secret",
        placeholder: "十六进制 HMAC 密钥，与调用方一致",
        sensitive: true,
        span: 24
      }
    ]
  },
  header: {
    kind: "pairs",
    label: "期望请求头",
    hint: "请求须携带全部配置项且逐一匹配；值加密存储",
    namePlaceholder: "Header 名，如 X-Api-Key",
    valuePlaceholder: "期望值"
  },
  query: {
    kind: "pairs",
    label: "期望查询参数",
    hint: "请求须携带全部配置项且逐一匹配；值加密存储",
    namePlaceholder: "参数名，如 api_key",
    valuePlaceholder: "期望值"
  },
  script: {
    kind: "pairs",
    label: "验证参数",
    hint: "脚本内通过 params.<参数名> 读取；值加密存储",
    namePlaceholder: "参数名",
    valuePlaceholder: "参数值"
  }
};

/**
 * Resolve the parameter shape of a scheme. Custom schemes registered on the
 * backend are unknown here, so they keep the free pair list.
 */
export function resolveAuthParamsSpec(direction: Direction, scheme: string): AuthParamsSpec {
  const specs = direction === "outbound" ? OUTBOUND_PARAM_SPECS : INBOUND_PARAM_SPECS;

  return specs[scheme] ?? {
    kind: "pairs",
    label: direction === "outbound" ? "认证参数" : "验证参数",
    hint: "自定义方案，按方案约定填写参数"
  };
}

/**
 * Collapse a params record to what the selected scheme actually declares:
 * fixed schemes keep only their declared, non-blank fields (dropping keys left
 * over from a previously selected scheme), `none` submits nothing, and pair
 * schemes pass through untouched.
 */
export function pruneAuthParams(
  direction: Direction,
  scheme: string,
  params: Record<string, string>
): Record<string, string> {
  const spec = resolveAuthParamsSpec(direction, scheme);

  if (spec.kind === "none") {
    return {};
  }

  if (spec.kind === "pairs") {
    return params;
  }

  const pruned: Record<string, string> = {};

  for (const field of spec.fields) {
    const value = params[field.name];

    if (value) {
      pruned[field.name] = value;
    }
  }

  return pruned;
}

export interface AuthParamsFieldsProps {
  /**
   * Which flow the scheme belongs to; decides the spec vocabulary.
   */
  direction: Direction;
  /**
   * The selected scheme name.
   */
  scheme: string;
  /**
   * The auth config's params record.
   */
  value: Record<string, string> | undefined;
  /**
   * Emitted with the next record on every edit.
   */
  onChange: (value: Record<string, string>) => void;
}

/**
 * The scheme-aware auth parameter editor: dedicated inputs for schemes with a
 * fixed parameter set, the free pair list only where parameter names are
 * user-defined, and nothing at all for `none`.
 */
export function AuthParamsFields({
  direction,
  scheme,
  value,
  onChange
}: AuthParamsFieldsProps) {
  const spec = resolveAuthParamsSpec(direction, scheme);

  if (spec.kind === "none") {
    return null;
  }

  if (spec.kind === "pairs") {
    return (
      <Labeled hint={spec.hint} label={spec.label}>
        <ParamsEditor
          namePlaceholder={spec.namePlaceholder}
          value={value}
          valuePlaceholder={spec.valuePlaceholder}
          onChange={onChange}
        />
      </Labeled>
    );
  }

  const params = value ?? {};

  const setParam = (name: string, next: string) => {
    onChange({ ...params, [name]: next });
  };

  const hasSensitive = spec.fields.some(field => field.sensitive);

  return (
    <Stack gap="small">
      <Grid columnGap="small" rowGap="small">
        {spec.fields.map(field => (
          <Grid.Item key={field.name} span={field.span ?? 12}>
            <Labeled hint={field.hint} label={field.label}>
              {field.rows
                ? (
                    <Input.TextArea
                      aria-label={field.label}
                      placeholder={field.placeholder}
                      rows={field.rows}
                      value={params[field.name] ?? ""}
                      onChange={event => setParam(field.name, event.target.value)}
                    />
                  )
                : field.sensitive
                  ? (
                      <Input.Password
                        aria-label={field.label}
                        autoComplete="new-password"
                        placeholder={field.placeholder}
                        value={params[field.name] ?? ""}
                        onChange={event => setParam(field.name, event.target.value)}
                      />
                    )
                  : (
                      <Input
                        aria-label={field.label}
                        placeholder={field.placeholder}
                        value={params[field.name] ?? ""}
                        onChange={event => setParam(field.name, event.target.value)}
                      />
                    )}
            </Labeled>
          </Grid.Item>
        ))}
      </Grid>

      {hasSensitive
        ? (
            <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
              敏感参数加密存储；编辑时保持 ****** 即沿用已保存的值
            </Text>
          )
        : null}
    </Stack>
  );
}
