import type { System, SystemParams } from "../../types";

import { INBOUND_AUTH_SCHEME_LABELS, OUTBOUND_AUTH_SCHEME_LABELS } from "../../components";
import { INBOUND_AUTH_SCHEMES, OUTBOUND_AUTH_SCHEMES } from "../../types";

interface DataSourceFormValues {
  kind: string;
  mode: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  schema: string;
  path: string;
  sslMode: string;
  sslRootCert: string;
}

/**
 * The system form's values. The optional config sections carry an `enabled`
 * flag so they can be toggled on/off; they are collapsed back to `null` (or
 * omitted params) when converted to the API model.
 */
export interface SystemFormValues {
  id?: string;
  code: string;
  name: string;
  baseUrl: string;
  params: Record<string, string>;
  timeoutMs: number;
  isEnabled: boolean;
  outboundAuth: { scheme: string; params: Record<string, string>; script: string };
  envelopeEnabled: boolean;
  envelope: { request: string; response: string };
  inboundEnabled: boolean;
  inboundAuth: { scheme: string; params: Record<string, string>; script: string };
  dataSourceEnabled: boolean;
  dataSource: DataSourceFormValues;
  retryEnabled: boolean;
  retry: { maxAttempts: number; initialBackoffMs: number; maxBackoffMs: number };
}

const DEFAULT_DATA_SOURCE: DataSourceFormValues = {
  kind: "postgres",
  mode: "read_only",
  host: "",
  port: 0,
  user: "",
  password: "",
  database: "",
  schema: "",
  path: "",
  sslMode: "disable",
  sslRootCert: ""
};

function blankToUndefined(value: string): string | undefined {
  return value || undefined;
}

function zeroToUndefined(value: number): number | undefined {
  return value || undefined;
}

/**
 * Project a saved system into editable form values (masked secrets carried through).
 */
export function systemToFormValues(row: System): SystemFormValues {
  const ds = row.dataSource;
  const envelope = row.outboundEnvelope;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    baseUrl: row.baseUrl ?? "",
    params: row.params ?? {},
    timeoutMs: row.timeoutMs ?? 0,
    isEnabled: row.isEnabled,
    outboundAuth: {
      scheme: row.outboundAuth?.scheme ?? "none",
      params: row.outboundAuth?.params ?? {},
      script: row.outboundAuth?.script ?? ""
    },
    envelopeEnabled: Boolean(envelope),
    envelope: {
      request: envelope?.request ?? "",
      response: envelope?.response ?? ""
    },
    inboundEnabled: Boolean(row.inboundAuth),
    inboundAuth: {
      scheme: row.inboundAuth?.scheme ?? "none",
      params: row.inboundAuth?.params ?? {},
      script: row.inboundAuth?.script ?? ""
    },
    dataSourceEnabled: Boolean(ds),
    dataSource: ds
      ? {
          kind: ds.kind,
          mode: ds.mode ?? "read_only",
          host: ds.host ?? "",
          port: ds.port ?? 0,
          user: ds.user ?? "",
          password: ds.password ?? "",
          database: ds.database ?? "",
          schema: ds.schema ?? "",
          path: ds.path ?? "",
          sslMode: ds.sslMode ?? "disable",
          sslRootCert: ds.sslRootCert ?? ""
        }
      : { ...DEFAULT_DATA_SOURCE },
    retryEnabled: Boolean(row.retry),
    retry: {
      maxAttempts: row.retry?.maxAttempts ?? 3,
      initialBackoffMs: row.retry?.initialBackoffMs ?? 0,
      maxBackoffMs: row.retry?.maxBackoffMs ?? 0
    }
  };
}

/**
 * Convert the form values into the API params, collapsing disabled sections.
 */
export function systemFormToParams(values: SystemFormValues): SystemParams {
  const envelopeRequest = blankToUndefined(values.envelope.request);
  const envelopeResponse = blankToUndefined(values.envelope.response);
  const hasEnvelope = values.envelopeEnabled && Boolean(envelopeRequest ?? envelopeResponse);

  return {
    id: values.id,
    code: values.code,
    name: values.name,
    baseUrl: values.baseUrl,
    params: values.params,
    timeoutMs: values.timeoutMs,
    isEnabled: values.isEnabled,
    outboundAuth: {
      scheme: values.outboundAuth.scheme,
      params: values.outboundAuth.params,
      script: values.outboundAuth.scheme === "script" ? values.outboundAuth.script : undefined
    },
    outboundEnvelope: hasEnvelope
      ? { request: envelopeRequest, response: envelopeResponse }
      : null,
    inboundAuth: values.inboundEnabled
      ? {
          scheme: values.inboundAuth.scheme,
          params: values.inboundAuth.params,
          script: values.inboundAuth.scheme === "script" ? values.inboundAuth.script : undefined
        }
      : null,
    dataSource: values.dataSourceEnabled
      ? {
          kind: values.dataSource.kind,
          mode: values.dataSource.mode === "read_only" ? undefined : "read_write",
          host: blankToUndefined(values.dataSource.host),
          port: zeroToUndefined(values.dataSource.port),
          user: blankToUndefined(values.dataSource.user),
          password: blankToUndefined(values.dataSource.password),
          database: blankToUndefined(values.dataSource.database),
          schema: blankToUndefined(values.dataSource.schema),
          path: blankToUndefined(values.dataSource.path),
          sslMode: blankToUndefined(values.dataSource.sslMode),
          sslRootCert: blankToUndefined(values.dataSource.sslRootCert)
        }
      : null,
    retry: values.retryEnabled
      ? {
          maxAttempts: values.retry.maxAttempts,
          initialBackoffMs: zeroToUndefined(values.retry.initialBackoffMs),
          maxBackoffMs: zeroToUndefined(values.retry.maxBackoffMs)
        }
      : null
  };
}

/**
 * Defaults for a newly created system.
 */
export const SYSTEM_FORM_DEFAULTS: SystemFormValues = {
  code: "",
  name: "",
  baseUrl: "",
  params: {},
  timeoutMs: 0,
  isEnabled: true,
  outboundAuth: {
    scheme: "none",
    params: {},
    script: ""
  },
  envelopeEnabled: false,
  envelope: { request: "", response: "" },
  inboundEnabled: false,
  inboundAuth: {
    scheme: "none",
    params: {},
    script: ""
  },
  dataSourceEnabled: false,
  dataSource: { ...DEFAULT_DATA_SOURCE },
  retryEnabled: false,
  retry: {
    maxAttempts: 3,
    initialBackoffMs: 0,
    maxBackoffMs: 0
  }
};

export const DB_KIND_OPTIONS = [
  { label: "PostgreSQL", value: "postgres" },
  { label: "MySQL", value: "mysql" },
  { label: "Oracle", value: "oracle" },
  { label: "SQL Server", value: "sqlserver" },
  { label: "SQLite", value: "sqlite" }
];

export const SSL_MODE_OPTIONS = [
  { label: "disable", value: "disable" },
  { label: "require", value: "require" },
  { label: "verify-ca", value: "verify-ca" },
  { label: "verify-full", value: "verify-full" }
];

export const DATA_SOURCE_MODE_OPTIONS = [
  { label: "只读（sql.query）", value: "read_only" },
  { label: "读写（sql.exec）", value: "read_write" }
];

export const OUTBOUND_AUTH_SCHEME_OPTIONS = OUTBOUND_AUTH_SCHEMES.map(scheme => {
  return {
    label: OUTBOUND_AUTH_SCHEME_LABELS[scheme] ?? scheme,
    value: scheme
  };
});

export const INBOUND_AUTH_SCHEME_OPTIONS = INBOUND_AUTH_SCHEMES.map(scheme => {
  return {
    label: INBOUND_AUTH_SCHEME_LABELS[scheme] ?? scheme,
    value: scheme
  };
});

export const OUTBOUND_AUTH_HINTS: Record<string, string> = {
  none: "无需参数",
  http_basic: "需要参数：username、password",
  bearer: "需要参数：token",
  header: "每个参数即一个凭据请求头（名称 → 值），可配多组",
  query: "每个参数即一个凭据查询参数（名称 → 值），可配多组",
  signature: "需要参数：appId、secret（hex）；按框架 HMAC 约定签名",
  script: "在下方脚本中编写签名逻辑，返回需追加的凭据请求头"
};

export const INBOUND_AUTH_HINTS: Record<string, string> = {
  none: "公开：任何来源都可投递，请谨慎使用",
  ip: "需要参数：whitelist（逗号分隔的 IP / CIDR）",
  http_basic: "需要参数：username、password",
  bearer: "需要参数：token",
  header: "每个参数即一对期望请求头（名称 → 值），需全部匹配",
  query: "每个参数即一对期望查询参数（名称 → 值），需全部匹配",
  signature: "需要参数：secret（hex）",
  script: "在下方脚本中编写验证逻辑，返回真值即放行"
};
