import type { MultiSelectField } from "../../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";

import { MobileMultiSelectInput } from "./multi-select";

// antd-mobile's Popup drives pointer-events through a @react-spring animation
// that never completes under jsdom, so disable the CSS pointer-events guard
// while still dispatching real userEvent clicks.
function setupUser(): ReturnType<typeof userEvent.setup> {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

function makeField(overrides: Partial<MultiSelectField> = {}): MultiSelectField {
  return {
    id: "Field_ms",
    type: "multi-select",
    key: "cities",
    label: "城市",
    dataSource: {
      kind: "static",
      options: [
        { label: "北京", value: "bj" },
        { label: "上海", value: "sh" },
        { label: "深圳", value: "sz" }
      ]
    },
    ...overrides
  };
}

describe("MobileMultiSelectInput", () => {
  it("shows 请选择 as the default placeholder when none is configured", () => {
    render(<MobileMultiSelectInput domId="field-ms" field={makeField()} value={[]} onChange={vi.fn()} />);

    expect(screen.getByText("请选择")).toBeInTheDocument();
  });

  it("shows the placeholder when no value is selected", () => {
    render(
      <MobileMultiSelectInput
        domId="field-ms"
        field={makeField({ placeholder: "请选择城市" })}
        value={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("请选择城市")).toBeInTheDocument();
  });

  it("shows the labels of seeded values", () => {
    render(
      <MobileMultiSelectInput
        domId="field-ms"
        field={makeField()}
        value={["bj", "sh"]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("北京、上海")).toBeInTheDocument();
  });

  it("falls back to raw values when options are missing", () => {
    render(
      <MobileMultiSelectInput
        domId="field-ms"
        field={makeField({ dataSource: undefined, placeholder: "请选择城市" })}
        value={["bj", "sh"]}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByText("请选择城市")).not.toBeInTheDocument();
    expect(screen.getByText("bj、sh")).toBeInTheDocument();
  });

  it("commits selected values on confirm", async () => {
    const user = setupUser();
    const onChange = vi.fn();

    render(
      <MobileMultiSelectInput domId="field-ms" field={makeField()} value={[]} onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "城市" }));
    await user.click(await screen.findByText("北京"));
    await user.click(screen.getByText("深圳"));
    await user.click(screen.getByRole("button", { name: "确定" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["bj", "sz"]));
  });

  it("discards draft changes when canceled", async () => {
    const user = setupUser();
    const onChange = vi.fn();

    render(
      <MobileMultiSelectInput domId="field-ms" field={makeField()} value={["bj"]} onChange={onChange} />
    );

    await user.click(screen.getByRole("button", { name: "城市" }));
    await user.click(await screen.findByText("上海"));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("enforces maxCount by blocking additional selections while allowing unchecking", async () => {
    const user = setupUser();
    const onChange = vi.fn();

    render(
      <MobileMultiSelectInput
        domId="field-ms"
        field={makeField({ maxCount: 2 })}
        value={["bj", "sh"]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "城市" }));
    // Tapping a third unselected option must not add it past maxCount.
    await user.click(await screen.findByText("深圳"));
    await user.click(screen.getByRole("button", { name: "确定" }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(["bj", "sh"]));

    // Unchecking one option frees a slot for the third option.
    await user.click(screen.getByRole("button", { name: "城市" }));
    await user.click(await screen.findByText("上海"));
    await user.click(screen.getByText("深圳"));
    await user.click(screen.getByRole("button", { name: "确定" }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(["bj", "sz"]));
  });

  it("commits an empty array when an allowClear field is cleared from the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MobileMultiSelectInput
        domId="field-ms"
        field={makeField({ allowClear: true })}
        value={["bj"]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "清除" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("offers no clear affordance unless allowClear is enabled", () => {
    render(
      <MobileMultiSelectInput domId="field-ms" field={makeField()} value={["bj"]} onChange={vi.fn()} />
    );

    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("renders disabled without a clear affordance", () => {
    render(
      <MobileMultiSelectInput
        disabled
        domId="field-ms"
        field={makeField({ allowClear: true })}
        value={["bj"]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "城市" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "清除" })).not.toBeInTheDocument();
  });

  it("renders descriptions, hides child options, and blocks selecting disabled items", async () => {
    const user = setupUser();
    const onChange = vi.fn();

    render(
      <MobileMultiSelectInput
        domId="field-ms"
        value={["old"]}
        field={makeField({
          dataSource: {
            kind: "static",
            options: [
              {
                label: "北京",
                value: "bj",
                description: "首都城市",
                children: [{ label: "海淀区", value: "hd" }]
              },
              {
                label: "归档城市",
                value: "old",
                disabled: true,
                description: "已停用"
              }
            ]
          }
        })}
        onChange={onChange}
      />
    );

    expect(screen.getByText("归档城市")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "城市" }));
    expect(await screen.findByText("首都城市")).toBeInTheDocument();
    expect(screen.getByText("已停用")).toBeInTheDocument();
    expect(screen.queryByText("海淀区")).not.toBeInTheDocument();

    await user.click(screen.getByText("北京"));
    await user.click(screen.getByRole("button", { name: "确定" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["old", "bj"]));
  });
});
