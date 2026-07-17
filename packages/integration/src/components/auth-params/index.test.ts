import type { Direction } from "../../types";

import { describe, expect, it } from "vitest";

import { pruneAuthParams, resolveAuthParamsSpec } from ".";

function fixedFieldNames(direction: Direction, scheme: string): string[] {
  const spec = resolveAuthParamsSpec(direction, scheme);

  return spec.kind === "fixed" ? spec.fields.map(field => field.name) : [];
}

describe("resolveAuthParamsSpec", () => {
  it("maps the built-in fixed schemes to their declared fields", () => {
    expect(fixedFieldNames("outbound", "signature"), "outbound signature declares appId + secret").toEqual(["appId", "secret"]);
    expect(fixedFieldNames("outbound", "bearer"), "outbound bearer declares token").toEqual(["token"]);
    expect(fixedFieldNames("inbound", "signature"), "inbound signature declares secret only").toEqual(["secret"]);
    expect(fixedFieldNames("inbound", "http_basic"), "inbound http_basic declares username + password").toEqual(["username", "password"]);
    expect(fixedFieldNames("inbound", "ip"), "inbound ip declares whitelist").toEqual(["whitelist"]);
  });

  it("keeps the free pair list for user-defined parameter schemes", () => {
    expect(resolveAuthParamsSpec("outbound", "header").kind, "outbound header params are user-defined").toBe("pairs");
    expect(resolveAuthParamsSpec("outbound", "script").kind, "outbound script params are user-defined").toBe("pairs");
    expect(resolveAuthParamsSpec("inbound", "query").kind, "inbound query params are user-defined").toBe("pairs");
  });

  it("falls back to the pair list for unknown custom schemes", () => {
    const custom = resolveAuthParamsSpec("outbound", "vendor_hmac_v2");
    expect(custom.kind, "an unknown scheme should fall back to free pairs").toBe("pairs");
  });

  it("keeps ip inbound-only", () => {
    expect(resolveAuthParamsSpec("outbound", "ip").kind, "outbound has no built-in ip scheme").toBe("pairs");
  });
});

describe("pruneAuthParams", () => {
  it("keeps only the declared, non-blank fields of a fixed scheme", () => {
    const pruned = pruneAuthParams("outbound", "bearer", {
      token: "t-1",
      username: "left-over",
      appId: ""
    });

    expect(pruned, "only the declared token survives; stale keys are dropped").toEqual({ token: "t-1" });
  });

  it("drops blank declared fields instead of submitting empty strings", () => {
    const pruned = pruneAuthParams("outbound", "signature", {
      appId: "app-1",
      secret: ""
    });

    expect(pruned, "a blank secret is omitted rather than sent as empty").toEqual({ appId: "app-1" });
  });

  it("submits nothing for the none scheme", () => {
    expect(pruneAuthParams("inbound", "none", { token: "stale" }), "none carries no params").toEqual({});
  });

  it("passes pair schemes through untouched", () => {
    const params = {
      "X-Api-Key": "k",
      "X-Tenant": ""
    };

    expect(pruneAuthParams("inbound", "header", params), "pair schemes keep the record verbatim").toEqual(params);
  });
});
