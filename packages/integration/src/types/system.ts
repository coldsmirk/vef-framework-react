import type { FullAudited } from "./base";
import type { DataSourceMode } from "./enums";

/**
 * The database kind of a system's direct data source. The exact set mirrors
 * the Go `config.DBKind`; kept broad here so the form's option list is the
 * single source of the offered values.
 */
export type DbKind = string;

/**
 * The SSL mode of a system's direct data source, mirroring `config.SSLMode`.
 */
export type SslMode = string;

/**
 * A system's direct database connection (vendor views / exchange tables).
 * The password is stored encrypted and masked in management responses.
 */
export interface DataSourceConfig {
  kind: DbKind;
  /**
   * Gates script write access to this database; empty means read-only.
   */
  mode?: DataSourceMode;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  schema?: string;
  path?: string;
  sslMode?: SslMode;
  sslRootCert?: string;
}

/**
 * A system's outbound authentication scheme and its parameters. Values named
 * by the scheme's sensitive parameters arrive masked. `script` carries the
 * custom signing body for the `script` scheme.
 */
export interface OutboundAuthConfig {
  scheme: string;
  params?: Record<string, string>;
  script?: string;
}

/**
 * A system's outbound envelope scripts: the common wire structure most vendor
 * APIs repeat on every endpoint, wrapped once at the system level. Either side
 * may be empty, leaving that direction untouched.
 */
export interface OutboundEnvelopeConfig {
  /**
   * Wrap script: shapes the request the adapter issued into the wire request.
   */
  request?: string;
  /**
   * Unwrap script: turns the raw HTTP response into the adapter's call result.
   */
  response?: string;
}

/**
 * A system's inbound authentication scheme, verifying vendor-initiated calls.
 * `script` carries the custom verification body for the `script` scheme.
 */
export interface InboundAuthConfig {
  scheme: string;
  params?: Record<string, string>;
  script?: string;
}

/**
 * Declarative retry configuration for a system's outbound calls.
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

/**
 * One external system instance: where it lives and how to authenticate with
 * it in both directions. Mirrors the Go `integration.System`.
 */
export interface System extends FullAudited {
  code: string;
  name: string;
  baseUrl?: string;
  outboundAuth?: OutboundAuthConfig | null;
  outboundEnvelope?: OutboundEnvelopeConfig | null;
  inboundAuth?: InboundAuthConfig | null;
  dataSource?: DataSourceConfig | null;
  params?: Record<string, string> | null;
  timeoutMs?: number;
  retry?: RetryPolicy | null;
  isEnabled: boolean;
}

/**
 * Create/update parameters for a system. Sensitive values may carry the
 * masked placeholder to keep the stored secret unchanged.
 */
export interface SystemParams {
  id?: string;
  code: string;
  name: string;
  baseUrl?: string;
  outboundAuth?: OutboundAuthConfig | null;
  outboundEnvelope?: OutboundEnvelopeConfig | null;
  inboundAuth?: InboundAuthConfig | null;
  dataSource?: DataSourceConfig | null;
  params?: Record<string, string> | null;
  timeoutMs?: number;
  retry?: RetryPolicy | null;
  isEnabled: boolean;
}

/**
 * Search parameters for systems.
 */
export interface SystemSearch {
  code?: string;
  name?: string;
  isEnabled?: boolean;
}
