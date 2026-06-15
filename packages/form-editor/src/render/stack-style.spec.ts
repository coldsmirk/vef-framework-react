import { DEFAULT_STACK_GAP, GAP_SCALE_PX, resolveStackGap } from "./stack-style";

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
