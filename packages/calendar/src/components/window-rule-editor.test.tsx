import type { WindowRule } from "../types";

import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { render, screen } from "../../test-utils";
import { WindowRuleEditor } from "./window-rule-editor";

const INITIAL: WindowRule = { windows: [{}] };

function Field({ initial = INITIAL, onChange }: { initial?: WindowRule; onChange: (rule: WindowRule) => void }) {
  const [value, setValue] = useState(initial);

  return (
    <WindowRuleEditor
      value={value}
      onChange={rule => {
        setValue(rule);
        onChange(rule);
      }}
    />
  );
}

describe("WindowRuleEditor", () => {
  it("adds and removes open windows and blackouts independently", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Field initial={{ windows: [{ dayKinds: ["holiday"] }] }} onChange={changed} />);
    await user.click(screen.getByRole("button", { name: "添加开放窗口" }));
    await user.click(screen.getByRole("button", { name: "添加例外关闭窗口" }));
    await user.click(screen.getByRole("button", { name: "删除开放窗口 1" }));
    expect(changed).toHaveBeenLastCalledWith({ windows: [{}], blackouts: [{}] });
    await user.click(screen.getByRole("button", { name: "删除例外关闭窗口 1" }));
    expect(changed).toHaveBeenLastCalledWith({ windows: [{}], blackouts: undefined });
  });

  it("edits the month, date, weekday, day kind and workday ordinal", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Field onChange={changed} />);
    await user.click(screen.getByRole("button", { name: "2 月" }));
    await user.click(screen.getByRole("button", { name: "最后一天" }));
    await user.click(screen.getByRole("button", { name: "周一" }));
    await user.click(screen.getByRole("button", { name: "工作日" }));
    await user.click(screen.getByRole("combobox", { name: "每月第几个工作日" }));
    await user.click(await screen.findByText("第 1 个工作日"));
    await user.keyboard("{Escape}");
    expect(changed).toHaveBeenLastCalledWith({
      windows: [
        {
          months: [2],
          monthDays: [-1],
          weekdays: [1],
          dayKinds: ["workday"],
          workdayOrdinals: [1]
        }
      ]
    });
  });

  it("adds independent time spans and edits their wire-level seconds", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Field onChange={changed} />);
    await user.click(screen.getByRole("button", { name: "添加时段" }));
    await user.clear(screen.getByLabelText("开始时间"));
    await user.type(screen.getByLabelText("开始时间"), "18:30:15{Enter}");
    await user.click(screen.getByRole("button", { name: "添加时段" }));
    expect(changed).toHaveBeenLastCalledWith({
      windows: [
        {
          times: [
            { startsAt: "18:30:15", endsAt: "17:00:00" },
            { startsAt: "09:00:00", endsAt: "17:00:00" }
          ]
        }
      ]
    });
    await user.click(screen.getAllByRole("button", { name: "移除时段" })[0]!);
    expect(changed).toHaveBeenLastCalledWith({ windows: [{ times: [{ startsAt: "09:00:00", endsAt: "17:00:00" }] }] });
  });

  it("commits a complete inclusive date range and preserves the selected timezone", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Field initial={{ timezone: "UTC", windows: [{ dates: { startsAt: "2025-03-01", endsAt: "2025-03-10" } }] }} onChange={changed} />);
    await user.click(screen.getByPlaceholderText("开始日期"));
    await user.click(screen.getByTitle("2025-03-02"));
    await user.click(screen.getByTitle("2025-03-09"));
    expect(changed).toHaveBeenLastCalledWith({ timezone: "UTC", windows: [{ dates: { startsAt: "2025-03-02", endsAt: "2025-03-09" } }] });
  });
});
