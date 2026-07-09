import { DEFAULT_STACK_GAP, GAP_SCALE_PX, resolveStackGap, stackSlotStyle } from "./stack-style";

describe("resolveStackGap", () => {
  it("maps a named scale to its pixel value", () => {
    expect(resolveStackGap("small", 99)).toBe(GAP_SCALE_PX.small);
    expect(resolveStackGap("medium", 99)).toBe(GAP_SCALE_PX.medium);
    expect(resolveStackGap("large", 99)).toBe(GAP_SCALE_PX.large);
  });

  it("falls back to the inherited gap when the scale is unset", () => {
    expect(resolveStackGap(undefined, 42)).toBe(42);
  });

  it("lets a container scale override the inherited fallback", () => {
    // A container that pins "small" ignores a larger inherited gap.
    expect(resolveStackGap("small", GAP_SCALE_PX.large)).toBe(GAP_SCALE_PX.small);
  });
});

describe("DEFAULT_STACK_GAP", () => {
  it("is the medium scale in pixels", () => {
    expect(DEFAULT_STACK_GAP).toBe(GAP_SCALE_PX.medium);
  });
});

describe("stackSlotStyle", () => {
  it("formats each length as its value plus unit", () => {
    const style = stackSlotStyle({
      width: { value: 500, unit: "px" },
      minWidth: { value: 300, unit: "px" },
      maxWidth: { value: 60, unit: "%" }
    });

    expect(style.width).toBe("500px");
    expect(style.minWidth).toBe("300px");
    expect(style.maxWidth).toBe("60%");
  });

  it("leaves an omitted min/max unconstrained", () => {
    const style = stackSlotStyle({ width: { value: 400, unit: "px" } });

    expect(style.width).toBe("400px");
    expect(style.minWidth).toBeUndefined();
    expect(style.maxWidth).toBeUndefined();
  });

  it("defaults an omitted width to 100% so a runtime flex item keeps full width", () => {
    // Without an explicit width the wrapper must fill the stack: as a direct
    // flex-column item, an auto margin with no width would cancel the stretch
    // and collapse the block. 100% gives the margin real free space to work on.
    expect(stackSlotStyle({ align: "center" }).width).toBe("100%");
    expect(stackSlotStyle({ maxWidth: { value: 500, unit: "px" } }).width).toBe("100%");
    expect(stackSlotStyle({ width: { value: 500, unit: "px" } }).width).toBe("500px");
  });

  it("centers with auto inline margins", () => {
    expect(stackSlotStyle({ align: "center" }).marginInline).toBe("auto");
  });

  it("pushes a start-aligned block left with a trailing auto margin", () => {
    const style = stackSlotStyle({ align: "start" });

    expect(style.marginInlineEnd).toBe("auto");
    expect(style.marginInlineStart).toBeUndefined();
  });

  it("pushes an end-aligned block right with a leading auto margin", () => {
    const style = stackSlotStyle({ align: "end" });

    expect(style.marginInlineStart).toBe("auto");
    expect(style.marginInlineEnd).toBeUndefined();
  });

  it("adds no alignment margins when align is unset", () => {
    const style = stackSlotStyle({ width: { value: 500, unit: "px" } });

    expect(style.marginInline).toBeUndefined();
    expect(style.marginInlineStart).toBeUndefined();
    expect(style.marginInlineEnd).toBeUndefined();
  });
});
