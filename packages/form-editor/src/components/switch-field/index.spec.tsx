import type { SwitchField } from "../../types";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { switchFieldDefinition } from "./index";

describe("switch field", () => {
  it("defines a keyed boolean field with serializable defaults", () => {
    expect(switchFieldDefinition.config).toMatchObject({ type: "switch", keyed: true });
    expect(switchFieldDefinition.config.create()).toEqual({ type: "switch", label: "开关" });
  });

  it("renders the label and a switch", () => {
    const { Component } = switchFieldDefinition;
    const field: SwitchField = {
      id: "Field_s",
      type: "switch",
      key: "s",
      label: "启用"
    };

    if (!Component) {
      throw new Error("switch field is missing a Component");
    }

    render(<Component domId="field-s" field={field} value={false} onChange={vi.fn()} />);

    expect(screen.getByText("启用")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("marks the inline label when a runtime require linkage sets required", () => {
    const { Component } = switchFieldDefinition;
    const field: SwitchField = {
      id: "Field_s",
      type: "switch",
      key: "s",
      label: "启用"
    };

    if (!Component) {
      throw new Error("switch field is missing a Component");
    }

    render(<Component required domId="field-s" field={field} value={false} onChange={vi.fn()} />);

    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("omits the required marker by default", () => {
    const { Component } = switchFieldDefinition;
    const field: SwitchField = {
      id: "Field_s",
      type: "switch",
      key: "s",
      label: "启用"
    };

    if (!Component) {
      throw new Error("switch field is missing a Component");
    }

    render(<Component domId="field-s" field={field} value={false} onChange={vi.fn()} />);

    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  describe("appearance", () => {
    it("renders the on text inside the switch track", () => {
      const { Component } = switchFieldDefinition;
      const field: SwitchField = {
        id: "Field_s",
        type: "switch",
        key: "s",
        label: "启用",
        onText: "开"
      };

      if (!Component) {
        throw new Error("switch field is missing a Component");
      }

      render(<Component domId="field-s" field={field} value={false} onChange={vi.fn()} />);

      expect(screen.getByRole("switch")).toContainElement(screen.getByText("开"));
    });

    it("renders the off text inside the switch track", () => {
      const { Component } = switchFieldDefinition;
      const field: SwitchField = {
        id: "Field_s",
        type: "switch",
        key: "s",
        label: "启用",
        offText: "关"
      };

      if (!Component) {
        throw new Error("switch field is missing a Component");
      }

      render(<Component domId="field-s" field={field} value={false} onChange={vi.fn()} />);

      expect(screen.getByRole("switch")).toContainElement(screen.getByText("关"));
    });

    it("applies the small size to the switch", () => {
      const { Component } = switchFieldDefinition;
      const field: SwitchField = {
        id: "Field_s",
        type: "switch",
        key: "s",
        label: "启用",
        size: "small"
      };

      if (!Component) {
        throw new Error("switch field is missing a Component");
      }

      render(<Component domId="field-s" field={field} value={false} onChange={vi.fn()} />);

      expect(screen.getByRole("switch")).toHaveClass("ant-switch-small");
    });

    it("renders a default-sized switch without the small modifier", () => {
      const { Component } = switchFieldDefinition;
      const field: SwitchField = {
        id: "Field_s",
        type: "switch",
        key: "s",
        label: "启用"
      };

      if (!Component) {
        throw new Error("switch field is missing a Component");
      }

      render(<Component domId="field-s" field={field} value={false} onChange={vi.fn()} />);

      expect(screen.getByRole("switch")).not.toHaveClass("ant-switch-small");
    });
  });
});
