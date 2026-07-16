import type { BusinessBindingConfig } from "../../../types";

import { createEmptyDraft, isBindingValid } from "./types";

function validBinding(): BusinessBindingConfig {
  return {
    tableName: "biz_order",
    keyColumns: ["id"],
    statusColumn: "approval_status",
    instanceIdColumn: "approval_instance_id"
  };
}

describe("isBindingValid", () => {
  it("accepts a complete minimal binding", () => {
    expect(isBindingValid(validBinding())).toBe(true);
  });

  it("accepts optional time columns when they are identifiers", () => {
    expect(isBindingValid({
      ...validBinding(),
      startedAtColumn: "started_at",
      finishedAtColumn: "finished_at"
    })).toBe(true);
  });

  it("accepts composite key columns", () => {
    expect(isBindingValid({ ...validBinding(), keyColumns: ["tenant_id", "order_no"] })).toBe(true);
  });

  it("rejects an absent binding", () => {
    expect(isBindingValid(undefined)).toBe(false);
  });

  it("rejects empty key columns", () => {
    expect(isBindingValid({ ...validBinding(), keyColumns: [] })).toBe(false);
  });

  it("rejects a missing instance-id column", () => {
    expect(isBindingValid({ ...validBinding(), instanceIdColumn: undefined })).toBe(false);
  });

  it("rejects a non-identifier table name", () => {
    expect(isBindingValid({ ...validBinding(), tableName: "biz-order" })).toBe(false);
  });

  it("rejects a non-identifier key column", () => {
    expect(isBindingValid({ ...validBinding(), keyColumns: ["order no"] })).toBe(false);
  });

  it("rejects a blank status-mapping value", () => {
    expect(isBindingValid({ ...validBinding(), statusMapping: { approved: " " } })).toBe(false);
  });

  it("accepts a populated status mapping", () => {
    expect(isBindingValid({ ...validBinding(), statusMapping: { approved: "PASSED" } })).toBe(true);
  });
});

describe("createEmptyDraft", () => {
  it("seeds the given tenant with standalone defaults", () => {
    const draft = createEmptyDraft("t1");

    expect(draft.basic.tenantId).toBe("t1");
    expect(draft.basic.bindingMode).toBe("standalone");
    expect(draft.basic.isAllInitiationAllowed).toBe(false);
    expect(draft.storageMode).toBe("json");
    expect(draft.flowDefinition.nodes).toHaveLength(0);
  });
});
