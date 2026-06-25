import type { FormEvent } from "react";

import type { ButtonField } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button as ButtonRenderer } from ".";

const field: ButtonField = {
  id: "Field_submit",
  type: "button",
  label: "提交",
  action: "submit"
};

describe("Button", () => {
  it("keeps submit semantics when rendered through the framework button", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    render(
      <form onSubmit={handleSubmit}>
        <ButtonRenderer
          domId="submit-button"
          field={field}
          value={undefined}
          onChange={vi.fn()}
        />
      </form>
    );

    const button = screen.getByRole("button", { name: "提交" });

    expect(button).toHaveAttribute("type", "submit");

    await user.click(button);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders the configured leading icon", () => {
    render(
      <ButtonRenderer
        domId="icon-button"
        field={{ ...field, icon: "house" }}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button").querySelector("svg")).toBeInTheDocument();
  });

  it("drives the antd button style from buttonType while keeping submit semantics", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    render(
      <form onSubmit={handleSubmit}>
        <ButtonRenderer
          domId="link-button"
          field={{ ...field, buttonType: "link" }}
          value={undefined}
          onChange={vi.fn()}
        />
      </form>
    );

    const button = screen.getByRole("button", { name: "提交" });

    expect(button).toHaveClass("ant-btn-link");
    expect(button).toHaveAttribute("type", "submit");

    await user.click(button);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders a danger button when danger is set", () => {
    render(
      <ButtonRenderer
        domId="danger-button"
        field={{ ...field, danger: true }}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "提交" })).toHaveClass("ant-btn-dangerous");
  });

  it("stretches to a block button when block is set", () => {
    render(
      <ButtonRenderer
        domId="block-button"
        field={{ ...field, block: true }}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "提交" })).toHaveClass("ant-btn-block");
  });

  it("renders a ghost button when ghost is set", () => {
    render(
      <ButtonRenderer
        domId="ghost-button"
        field={{ ...field, ghost: true }}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "提交" })).toHaveClass("ant-btn-background-ghost");
  });

  it("renders a round button when shape is round", () => {
    render(
      <ButtonRenderer
        domId="round-button"
        field={{ ...field, shape: "round" }}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "提交" })).toHaveClass("ant-btn-round");
  });

  it("applies the configured control size", () => {
    render(
      <ButtonRenderer
        domId="large-button"
        field={{ ...field, size: "large" }}
        value={undefined}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "提交" })).toHaveClass("ant-btn-lg");
  });
});
