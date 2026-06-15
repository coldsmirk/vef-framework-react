import { createDefaultRegistry } from "./defaults";
import { createDefaultMobileRegistry } from "./defaults-mobile";

const MOBILE_FIELD_TYPES = [
  "textfield",
  "textarea",
  "number",
  "switch",
  "select",
  "radio",
  "checkbox-group",
  "date",
  "datetime",
  "daterange",
  "button",
  "divider",
  "alert-block",
  "paragraph"
];

const CONTAINER_TYPES = ["section", "tabs", "subform", "flex", "grid"];

describe("createDefaultMobileRegistry", () => {
  it("registers a renderer for every supported mobile field type", () => {
    const registry = createDefaultMobileRegistry();

    for (const type of MOBILE_FIELD_TYPES) {
      expect(registry.has(type)).toBe(true);
    }
  });

  it("registers the structural containers", () => {
    const registry = createDefaultMobileRegistry();

    for (const type of CONTAINER_TYPES) {
      expect(registry.has(type)).toBe(true);
    }
  });

  it("does not register the code editor on mobile", () => {
    expect(createDefaultMobileRegistry().has("code-editor")).toBe(false);
  });

  it("resolves an antd-mobile component for the keyed fields", () => {
    const registry = createDefaultMobileRegistry();

    expect(registry.get("textfield")?.Component).toBeDefined();
    expect(registry.get("select")?.Component).toBeDefined();
    expect(registry.get("daterange")?.Component).toBeDefined();
  });

  it("leaves property entries to the editor layer", () => {
    // Mirrors the PC default registry: built-in entry renderers are the
    // properties panel's statically imported fallback, never registered by
    // the engine-layer registry builders.
    expect(createDefaultMobileRegistry().getPropertyEntry("text")).toBeUndefined();
  });

  it("installs mobile container chrome distinct from the PC chrome", () => {
    expect(createDefaultMobileRegistry().getContainerChrome()).not.toBe(createDefaultRegistry().getContainerChrome());
  });

  it("reuses each PC field's config so palette grouping and the factory match", () => {
    const mobile = createDefaultMobileRegistry();
    const pc = createDefaultRegistry();

    expect(mobile.get("textfield")?.config).toBe(pc.get("textfield")?.config);
  });
});
