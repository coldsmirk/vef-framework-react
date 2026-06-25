import { createDefaultRegistry } from "./defaults";

describe("createDefaultRegistry", () => {
  it("registers the built-in code editor field", () => {
    const registry = createDefaultRegistry();

    expect(registry.has("code-editor")).toBe(true);
    expect(registry.get("code-editor")?.config).toMatchObject({
      type: "code-editor",
      name: "代码编辑器",
      keyed: true
    });
  });

  it("registers the selection fields", () => {
    const registry = createDefaultRegistry();

    expect(registry.has("select")).toBe(true);
    expect(registry.has("radio")).toBe(true);
    expect(registry.has("checkbox-group")).toBe(true);
  });

  it("leaves property entries to the editor layer", () => {
    // The engine registry must not depend on editor code: built-in entry
    // renderers are a properties-panel fallback (statically imported there),
    // so a freshly built default registry resolves none itself.
    const registry = createDefaultRegistry();

    expect(registry.getPropertyEntry("text")).toBeUndefined();
    expect(registry.getPropertyEntry("options-editor")).toBeUndefined();
    expect(registry.getPropertyEntry("linkage-rules")).toBeUndefined();
  });

  it("registers the textarea and presentation fields", () => {
    const registry = createDefaultRegistry();

    expect(registry.has("textarea")).toBe(true);
    expect(registry.has("divider")).toBe(true);
    expect(registry.has("alert-block")).toBe(true);
    expect(registry.has("paragraph")).toBe(true);
  });

  it("registers the date fields", () => {
    const registry = createDefaultRegistry();

    expect(registry.has("date")).toBe(true);
    expect(registry.has("datetime")).toBe(true);
    expect(registry.has("daterange")).toBe(true);
  });

  it("registers the layout containers, including the flex container", () => {
    const registry = createDefaultRegistry();

    expect(registry.has("section")).toBe(true);
    expect(registry.has("tabs")).toBe(true);
    expect(registry.has("subform")).toBe(true);
    expect(registry.has("flex")).toBe(true);
    expect(registry.get("flex")?.config).toMatchObject({
      type: "flex",
      group: "container",
      keyed: false
    });
  });

  it("registers the grid layout container", () => {
    const registry = createDefaultRegistry();

    expect(registry.has("grid")).toBe(true);
    expect(registry.get("grid")?.config).toMatchObject({
      type: "grid",
      group: "container",
      keyed: false
    });
  });
});
