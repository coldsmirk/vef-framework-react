import { defaultColors } from "./constants";
import { buildThemeConfig } from "./theme-config";

describe("config-provider/buildThemeConfig", () => {
  it("lifts primary-coloured text off the primary in dark mode", () => {
    expect(buildThemeConfig(true, defaultColors, true).token?.colorPrimaryText).toContain("color-mix");
  });

  it("leaves primary-coloured text to the algorithm in light mode", () => {
    expect(buildThemeConfig(false, defaultColors, true).token).not.toHaveProperty("colorPrimaryText");
  });
});
