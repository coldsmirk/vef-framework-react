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
  it("appends an open window or blackout without changing the other list", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const value: WindowRule = { windows: [{ dayKinds: ["holiday"] }], blackouts: [{}] };
    render(<WindowRuleEditor value={value} onChange={changed} />);
    await user.click(screen.getByText("添加开放窗口"));
    expect(changed).toHaveBeenLastCalledWith({ ...value, windows: [...value.windows, {}] });
    await user.click(screen.getByText("添加例外关闭窗口"));
    expect(changed).toHaveBeenLastCalledWith({ ...value, blackouts: [{}, {}] });
  });

  it("preserves the remaining open window when removing a sibling and the last blackout", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Field initial={{ windows: [{ dayKinds: ["holiday"] }, {}], blackouts: [{}] }} onChange={changed} />);
    await user.click(screen.getByLabelText("删除开放窗口 1"));
    expect(changed).toHaveBeenLastCalledWith({ windows: [{}], blackouts: [{}] });
    await user.click(screen.getByLabelText("删除例外关闭窗口 1"));
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

  it("explains identical endpoints inline and accepts a range crossing midnight", async () => {
    const user = userEvent.setup();
    render(<Field initial={{ windows: [{ times: [{ startsAt: "09:00:00", endsAt: "09:00:00" }] }] }} onChange={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("开始与结束时间不能相同");
    await user.clear(screen.getByLabelText("结束时间"));
    await user.type(screen.getByLabelText("结束时间"), "08:00:00{Enter}");
    expect(screen.queryByText("开始与结束时间不能相同")).not.toBeInTheDocument();
    expect(screen.getByText("次日结束")).toBeVisible();
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
