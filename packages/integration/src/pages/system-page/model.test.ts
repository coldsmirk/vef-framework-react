import type { System } from "../../types";
import type { SystemFormValues } from "./model";

import { describe, expect, it } from "vitest";

import { SYSTEM_FORM_DEFAULTS, systemFormToParams, systemToFormValues } from "./model";

const SAMPLE_DATA_SOURCE: SystemFormValues["dataSource"] = {
  kind: "postgres",
  mode: "read_only",
  host: "h",
  port: 5432,
  user: "",
  password: "",
  database: "db",
  schema: "",
  path: "",
  sslMode: "disable",
  sslRootCert: ""
};

describe("system model", () => {
  it("systemToFormValues reflects the presence of optional sections", () => {
    const row: System = {
      id: "1",
      code: "s",
      name: "n",
      isEnabled: true
    };

    const values = systemToFormValues(row);

    expect(values.inboundEnabled).toBe(false);
    expect(values.envelopeEnabled).toBe(false);
    expect(values.dataSourceEnabled).toBe(false);
    expect(values.retryEnabled).toBe(false);
    expect(values.outboundAuth.scheme).toBe("none");
  });

  it("systemFormToParams collapses disabled sections to null", () => {
    const params = systemFormToParams({
      ...SYSTEM_FORM_DEFAULTS,
      code: "s",
      name: "n"
    });

    expect(params.outboundEnvelope).toBeNull();
    expect(params.inboundAuth).toBeNull();
    expect(params.dataSource).toBeNull();
    expect(params.retry).toBeNull();
    expect(params.outboundAuth).toEqual({ scheme: "none", params: {} });
  });

  it("systemFormToParams keeps enabled sections and drops blank/zero fields", () => {
    const params = systemFormToParams({
      ...SYSTEM_FORM_DEFAULTS,
      code: "s",
      name: "n",
      dataSourceEnabled: true,
      dataSource: { ...SAMPLE_DATA_SOURCE }
    });

    expect(params.dataSource).not.toBeNull();
    expect(params.dataSource?.host).toBe("h");
    expect(params.dataSource?.port).toBe(5432);
    expect(params.dataSource?.user).toBeUndefined();
  });

  it("outbound signing script is only sent for the script scheme", () => {
    const withScript = systemFormToParams({
      ...SYSTEM_FORM_DEFAULTS,
      code: "s",
      name: "n",
      outboundAuth: {
        scheme: "script",
        params: {},
        script: "return {}"
      }
    });

    expect(withScript.outboundAuth?.script).toBe("return {}");

    const withoutScript = systemFormToParams({
      ...SYSTEM_FORM_DEFAULTS,
      code: "s",
      name: "n",
      outboundAuth: {
        scheme: "signature",
        params: { appId: "a", secret: "ff" },
        script: "ignored"
      }
    });

    expect(withoutScript.outboundAuth?.script).toBeUndefined();
  });

  it("outbound envelope is sent only when enabled with a non-empty script", () => {
    const enabledButEmpty = systemFormToParams({
      ...SYSTEM_FORM_DEFAULTS,
      code: "s",
      name: "n",
      envelopeEnabled: true,
      envelope: { request: "", response: "" }
    });

    expect(enabledButEmpty.outboundEnvelope).toBeNull();

    const enabled = systemFormToParams({
      ...SYSTEM_FORM_DEFAULTS,
      code: "s",
      name: "n",
      envelopeEnabled: true,
      envelope: { request: "return request", response: "" }
    });

    expect(enabled.outboundEnvelope).toEqual({ request: "return request", response: undefined });
  });

  it("data source write mode is sent only when read_write", () => {
    const readOnly = systemFormToParams({
      ...SYSTEM_FORM_DEFAULTS,
      code: "s",
      name: "n",
      dataSourceEnabled: true,
      dataSource: { ...SAMPLE_DATA_SOURCE, mode: "read_only" }
    });

    expect(readOnly.dataSource?.mode).toBeUndefined();

    const readWrite = systemFormToParams({
      ...SYSTEM_FORM_DEFAULTS,
      code: "s",
      name: "n",
      dataSourceEnabled: true,
      dataSource: { ...SAMPLE_DATA_SOURCE, mode: "read_write" }
    });

    expect(readWrite.dataSource?.mode).toBe("read_write");
  });

  it("inbound script is only sent for the script scheme", () => {
    const withScript = systemFormToParams({
      ...SYSTEM_FORM_DEFAULTS,
      code: "s",
      name: "n",
      inboundEnabled: true,
      inboundAuth: {
        scheme: "script",
        params: {},
        script: "return true"
      }
    });

    expect(withScript.inboundAuth?.script).toBe("return true");

    const withoutScript = systemFormToParams({
      ...SYSTEM_FORM_DEFAULTS,
      code: "s",
      name: "n",
      inboundEnabled: true,
      inboundAuth: {
        scheme: "ip",
        params: { whitelist: "1.2.3.4" },
        script: "ignored"
      }
    });

    expect(withoutScript.inboundAuth?.script).toBeUndefined();
  });
});
