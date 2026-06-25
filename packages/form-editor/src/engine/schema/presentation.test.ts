import type { Block, FormSchema, PresentationLayer } from "../../types";

import { currentLayer, emptyLayer, resolvePresentation, toRuntimeSchema, withPresentation } from "./presentation";

function field(id: string): Block {
  return {
    id,
    type: "textfield",
    key: id,
    label: id
  };
}

function schemaOf(pc: PresentationLayer, mobile?: PresentationLayer): FormSchema {
  return {
    id: "form-1",
    version: 2,
    variables: [
      {
        id: "v1",
        name: "v",
        type: "number",
        defaultValue: 1
      }
    ],
    dataSources: [
      {
        id: "ds",
        name: "ds",
        kind: "static",
        options: []
      }
    ],
    linkage: { rules: [] },
    presentations: mobile ? { pc, mobile } : { pc }
  };
}

describe("resolvePresentation", () => {
  it("returns the pc layer for the pc device", () => {
    const pc: PresentationLayer = { children: [field("a")] };

    expect(resolvePresentation(schemaOf(pc), "pc")).toBe(pc);
  });

  it("returns the mobile layer when the mobile device is designed", () => {
    const mobile: PresentationLayer = { children: [field("m")] };

    expect(resolvePresentation(schemaOf({ children: [] }, mobile), "mobile")).toBe(mobile);
  });

  it("returns undefined for an undesigned mobile device", () => {
    expect(resolvePresentation(schemaOf({ children: [] }), "mobile")).toBeUndefined();
  });
});

describe("currentLayer", () => {
  it("falls back to the empty layer for an undesigned mobile device", () => {
    expect(currentLayer(schemaOf({ children: [] }), "mobile")).toBe(emptyLayer());
  });

  it("returns the designed layer when present", () => {
    const pc: PresentationLayer = { children: [field("a")] };

    expect(currentLayer(schemaOf(pc), "pc")).toBe(pc);
  });
});

describe("emptyLayer", () => {
  it("returns a stable reference across calls", () => {
    expect(emptyLayer()).toBe(emptyLayer());
  });
});

describe("withPresentation", () => {
  it("writes the mobile layer without touching pc or the shared data layer", () => {
    const schema = schemaOf({ children: [field("a")] });
    const mobile: PresentationLayer = { children: [field("m")] };

    const next = withPresentation(schema, "mobile", mobile);

    expect(next.presentations.mobile).toBe(mobile);
    expect(next.presentations.pc).toBe(schema.presentations.pc);
    expect(next.variables).toBe(schema.variables);
    expect(next.dataSources).toBe(schema.dataSources);
    expect(next.linkage).toBe(schema.linkage);
  });

  it("replaces the pc layer", () => {
    const schema = schemaOf({ children: [field("a")] });
    const pc: PresentationLayer = { children: [field("b")] };

    expect(withPresentation(schema, "pc", pc).presentations.pc).toBe(pc);
  });
});

describe("toRuntimeSchema", () => {
  it("flattens a device layer with the shared data layer", () => {
    const pc: PresentationLayer = {
      children: [field("a")],
      gap: "large"
    };
    const schema = schemaOf(pc);

    const runtime = toRuntimeSchema(schema, "pc");

    expect(runtime).toEqual({
      id: "form-1",
      children: pc.children,
      gap: "large",
      variables: schema.variables,
      dataSources: schema.dataSources,
      linkage: schema.linkage
    });
  });

  it("returns undefined for an undesigned device", () => {
    expect(toRuntimeSchema(schemaOf({ children: [] }), "mobile")).toBeUndefined();
  });
});
