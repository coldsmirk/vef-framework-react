import type { Contract } from "../../types";

import { describe, expect, it } from "vitest";

import { CONTRACT_FORM_DEFAULTS, contractToFormValues, formValuesToParams } from "./model";

describe("contract model", () => {
  it("contractToFormValues stringifies schemas and empties null ones", () => {
    const row: Contract = {
      id: "1",
      code: "patient.query",
      name: "患者查询",
      description: "desc",
      inputSchema: { type: "object" },
      outputSchema: null,
      isEnabled: true
    };

    const values = contractToFormValues(row);

    expect(values.inputSchema).toBe(JSON.stringify({ type: "object" }, null, 2));
    expect(values.outputSchema).toBe("");
    expect(values.code).toBe("patient.query");
  });

  it("formValuesToParams parses schema text and collapses blank to null", () => {
    const params = formValuesToParams({
      ...CONTRACT_FORM_DEFAULTS,
      code: "c",
      name: "n",
      inputSchema: "{\"type\":\"string\"}",
      outputSchema: " ".repeat(3)
    });

    expect(params.inputSchema).toEqual({ type: "string" });
    expect(params.outputSchema).toBeNull();
  });

  it("carries labels through the form round-trip", () => {
    const row: Contract = {
      id: "1",
      code: "c",
      name: "n",
      isEnabled: true,
      labels: { scene: "inspection", mobile: "" }
    };

    const values = contractToFormValues(row);

    expect(values.labels).toEqual({ scene: "inspection", mobile: "" });
    expect(formValuesToParams(values).labels).toEqual({ scene: "inspection", mobile: "" });
  });

  it("defaults missing labels to an empty map", () => {
    const row: Contract = {
      id: "1",
      code: "c",
      name: "n",
      isEnabled: true
    };

    expect(contractToFormValues(row).labels).toEqual({});
  });

  it("round-trips a contract without losing schema content", () => {
    const row: Contract = {
      id: "1",
      code: "c",
      name: "n",
      description: null,
      inputSchema: { a: 1 },
      outputSchema: { b: 2 },
      isEnabled: false
    };

    const back = formValuesToParams(contractToFormValues(row));

    expect(back.inputSchema).toEqual({ a: 1 });
    expect(back.outputSchema).toEqual({ b: 2 });
    expect(back.isEnabled).toBe(false);
  });
});
