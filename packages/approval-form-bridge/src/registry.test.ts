import { createDefaultMobileRegistry, createDefaultRegistry } from "@vef-framework-react/form-editor";
import { describe, expect, it } from "vitest";

import { APPROVAL_EXCLUDED_FIELD_TYPES, createApprovalRegistries } from "./registry";

describe("createApprovalRegistries", () => {
  it("removes exactly the excluded widget types from both devices", () => {
    const { pc, mobile } = createApprovalRegistries();

    for (const type of APPROVAL_EXCLUDED_FIELD_TYPES) {
      expect(pc.has(type)).toBe(false);
      expect(mobile.has(type)).toBe(false);
    }
  });

  it("keeps every other default registration", () => {
    const { pc, mobile } = createApprovalRegistries();
    const excluded = new Set<string>(APPROVAL_EXCLUDED_FIELD_TYPES);

    const expectedPc = createDefaultRegistry().list().map(definition => definition.config.type).filter(type => !excluded.has(type));
    const expectedMobile = createDefaultMobileRegistry().list().map(definition => definition.config.type).filter(type => !excluded.has(type));

    expect(pc.list().map(definition => definition.config.type)).toEqual(expectedPc);
    expect(mobile.list().map(definition => definition.config.type)).toEqual(expectedMobile);
    expect(pc.has("subform")).toBe(true);
    expect(mobile.has("subform")).toBe(true);
  });

  it("keeps the container chrome of each device", () => {
    const { pc, mobile } = createApprovalRegistries();

    expect(pc.getContainerChrome()).toBeDefined();
    expect(mobile.getContainerChrome()).toBeDefined();
  });

  it("returns fresh instances on every call", () => {
    const first = createApprovalRegistries();
    const second = createApprovalRegistries();

    expect(first.pc).not.toBe(second.pc);
    expect(first.mobile).not.toBe(second.mobile);
  });
});
