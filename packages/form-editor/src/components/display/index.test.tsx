import type { AlertBlockField, DividerField, FieldDefinition, ParagraphField, PropertyEntry } from "../../types";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { alertBlockDefinition, dividerDefinition, paragraphDefinition } from "./index";

function entry(definition: FieldDefinition, id: string): PropertyEntry | undefined {
  return definition.properties?.flatMap(group => group.entries).find(item => item.id === id);
}

describe("display fields", () => {
  it("defines non-keyed presentation fields", () => {
    expect(dividerDefinition.config).toMatchObject({
      type: "divider",
      keyed: false,
      group: "presentation"
    });
    expect(alertBlockDefinition.config).toMatchObject({ type: "alert-block", keyed: false });
    expect(paragraphDefinition.config).toMatchObject({ type: "paragraph", keyed: false });
  });

  it("renders a divider with its title", () => {
    const { Component } = dividerDefinition;

    if (!Component) {
      throw new Error("divider is missing a Component");
    }

    const field: DividerField = {
      id: "D",
      type: "divider",
      title: "分组"
    };

    render(<Component domId="field-d" field={field} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText("分组")).toBeInTheDocument();
  });

  it("renders an alert with its message and description", () => {
    const { Component } = alertBlockDefinition;

    if (!Component) {
      throw new Error("alert is missing a Component");
    }

    const field: AlertBlockField = {
      id: "A",
      type: "alert-block",
      message: "注意",
      description: "请仔细填写",
      alertType: "warning"
    };

    render(<Component domId="field-a" field={field} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText("注意")).toBeInTheDocument();
    expect(screen.getByText("请仔细填写")).toBeInTheDocument();
  });

  it("renders a paragraph with its text", () => {
    const { Component } = paragraphDefinition;

    if (!Component) {
      throw new Error("paragraph is missing a Component");
    }

    const field: ParagraphField = {
      id: "P",
      type: "paragraph",
      text: "说明文字"
    };

    render(<Component domId="field-p" field={field} value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText("说明文字")).toBeInTheDocument();
  });

  describe("divider title placement", () => {
    const base: DividerField = {
      id: "D",
      type: "divider",
      title: "分组"
    };

    it("writes the title placement through its property entry", () => {
      const placement = entry(dividerDefinition, "titlePlacement");

      expect(placement?.read(base)).toBeUndefined();
      expect(placement?.write(base, "left")).toMatchObject({ titlePlacement: "left" });
    });

    it("shows the title placement entry only when the divider has a title", () => {
      const placement = entry(dividerDefinition, "titlePlacement");

      expect(placement?.visible?.(base)).toBe(true);
      expect(placement?.visible?.({ id: "D", type: "divider" })).toBe(false);
    });
  });

  describe("divider dashed", () => {
    const base: DividerField = { id: "D", type: "divider" };

    it("coerces the dashed flag through its property entry", () => {
      const dashed = entry(dividerDefinition, "dashed");

      expect(dashed?.read(base)).toBeUndefined();
      expect(dashed?.write(base, true)).toMatchObject({ dashed: true });
      expect(dashed?.write({ ...base, dashed: true }, false)).toMatchObject({ dashed: false });
    });
  });

  describe("alert show icon", () => {
    const base: AlertBlockField = {
      id: "A",
      type: "alert-block",
      message: "注意"
    };

    it("defaults the show-icon flag to on", () => {
      const showIcon = entry(alertBlockDefinition, "showIcon");

      expect(showIcon?.read(base)).toBe(true);
    });

    it("coerces the show-icon flag through its property entry", () => {
      const showIcon = entry(alertBlockDefinition, "showIcon");

      expect(showIcon?.write(base, false)).toMatchObject({ showIcon: false });
      expect(showIcon?.write({ ...base, showIcon: false }, true)).toMatchObject({ showIcon: true });
    });
  });

  describe("alert closable", () => {
    const base: AlertBlockField = {
      id: "A",
      type: "alert-block",
      message: "注意"
    };

    it("coerces the closable flag through its property entry", () => {
      const closable = entry(alertBlockDefinition, "closable");

      expect(closable?.read(base)).toBeUndefined();
      expect(closable?.write(base, true)).toMatchObject({ closable: true });
    });

    it("renders a close button when closable is enabled", () => {
      const { Component } = alertBlockDefinition;

      if (!Component) {
        throw new Error("alert is missing a Component");
      }

      render(
        <Component domId="field-a" field={{ ...base, closable: true }} value={undefined} onChange={vi.fn()} />
      );

      expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
    });
  });

  describe("alert banner", () => {
    const base: AlertBlockField = {
      id: "A",
      type: "alert-block",
      message: "注意"
    };

    it("coerces the banner flag through its property entry", () => {
      const banner = entry(alertBlockDefinition, "banner");

      expect(banner?.read(base)).toBeUndefined();
      expect(banner?.write(base, true)).toMatchObject({ banner: true });
    });
  });

  describe("paragraph text type", () => {
    const base: ParagraphField = {
      id: "P",
      type: "paragraph",
      text: "说明文字"
    };

    it("writes the text type through its property entry", () => {
      const textType = entry(paragraphDefinition, "textType");

      expect(textType?.read(base)).toBeUndefined();
      expect(textType?.write(base, "danger")).toMatchObject({ textType: "danger" });
    });
  });

  describe("paragraph strong", () => {
    const base: ParagraphField = {
      id: "P",
      type: "paragraph",
      text: "说明文字"
    };

    it("coerces the strong flag through its property entry", () => {
      const strong = entry(paragraphDefinition, "strong");

      expect(strong?.read(base)).toBeUndefined();
      expect(strong?.write(base, true)).toMatchObject({ strong: true });
    });

    it("renders the text in a strong element when strong is enabled", () => {
      const { Component } = paragraphDefinition;

      if (!Component) {
        throw new Error("paragraph is missing a Component");
      }

      render(<Component domId="field-p" field={{ ...base, strong: true }} value={undefined} onChange={vi.fn()} />);

      expect(screen.getByText("说明文字", { selector: "strong" })).toBeInTheDocument();
    });
  });

  describe("paragraph italic", () => {
    const base: ParagraphField = {
      id: "P",
      type: "paragraph",
      text: "说明文字"
    };

    it("coerces the italic flag through its property entry", () => {
      const italic = entry(paragraphDefinition, "italic");

      expect(italic?.read(base)).toBeUndefined();
      expect(italic?.write(base, true)).toMatchObject({ italic: true });
    });

    it("renders the text in an italic element when italic is enabled", () => {
      const { Component } = paragraphDefinition;

      if (!Component) {
        throw new Error("paragraph is missing a Component");
      }

      render(<Component domId="field-p" field={{ ...base, italic: true }} value={undefined} onChange={vi.fn()} />);

      expect(screen.getByText("说明文字", { selector: "i" })).toBeInTheDocument();
    });
  });
});
