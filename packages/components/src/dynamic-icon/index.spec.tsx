import { describe, expect, it } from "vitest";

import { render } from "../../test-utils";
import { DynamicIcon, dynamicIconNames } from "./index";

describe("dynamic-icon/DynamicIcon", () => {
  describe("dynamicIconNames", () => {
    it("exposes the lucide icon name set as a Set instance", () => {
      expect(dynamicIconNames).toBeInstanceOf(Set);
      expect(dynamicIconNames.size).toBeGreaterThan(0);
    });

    it("contains common lucide icon names such as 'plus'", () => {
      expect(dynamicIconNames.has("plus")).toBe(true);
    });
  });

  describe("rendering", () => {
    it("renders an svg fallback synchronously while a known icon is loading", () => {
      const { baseElement } = render(<DynamicIcon name="plus" />);

      expect(baseElement.querySelector("svg")).toBeInTheDocument();
    });

    it("renders the UnknownIcon svg when the name is not in the lucide icon set", () => {
      const { baseElement } = render(<DynamicIcon name={"definitely-not-a-real-icon" as never} />);

      expect(baseElement.querySelector("svg")).toBeInTheDocument();
    });
  });
});
