import type { System } from "../../types";

import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { render, screen } from "../../../../components/test-utils";
import { TestConnectionDrawer } from "./index";

function systemOf(code: string): System {
  return {
    id: code,
    createdAt: "2026-09-28 10:00:00",
    createdBy: "system",
    updatedAt: "2026-09-28 10:00:00",
    updatedBy: "system",
    code,
    name: code,
    baseUrl: `https://${code}.example.com`,
    isEnabled: true
  };
}

describe("TestConnectionDrawer", () => {
  it("resets the probe inputs when it targets another system", async () => {
    const user = userEvent.setup();
    const view = render(<TestConnectionDrawer open system={systemOf("his")} onClose={() => undefined} />);

    const path = screen.getByRole("textbox", { name: "探测路径" });
    await user.clear(path);
    await user.type(path, "/health");
    view.rerender(<TestConnectionDrawer open system={systemOf("lis")} onClose={() => undefined} />);

    expect(screen.getByRole("textbox", { name: "探测路径" })).toHaveValue("/");
  });

  it("keeps the probe inputs while the same system stays targeted", async () => {
    const user = userEvent.setup();
    const view = render(<TestConnectionDrawer open system={systemOf("his")} onClose={() => undefined} />);

    const path = screen.getByRole("textbox", { name: "探测路径" });
    await user.clear(path);
    await user.type(path, "/health");
    view.rerender(<TestConnectionDrawer open system={systemOf("his")} onClose={() => undefined} />);

    expect(screen.getByRole("textbox", { name: "探测路径" })).toHaveValue("/health");
  });
});
