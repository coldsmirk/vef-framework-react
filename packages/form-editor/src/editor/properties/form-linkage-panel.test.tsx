import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FieldLinkage, FormSchema } from "../../types";

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "@vef-framework-react/components";
import { useEffect } from "react";

import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { FormLinkagePanel } from "./form-linkage-panel";

function makeSchema(linkage?: FieldLinkage): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    ...linkage && { linkage },
    presentations: {
      pc: {
        children: [
          {
            id: "Field_amount",
            type: "number",
            key: "amount",
            label: "金额"
          }
        ]
      }
    }
  };
}

interface HarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

/**
 * Mirrors the right `表单` tab wiring: the form-scope linkage comes from the
 * store schema and commits patch it back.
 */
function Harness({ onReady }: HarnessProps): ReactElement {
  const api = useFormEditorStoreApi();
  const schema = useFormEditorStore(state => state.schema);

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return <FormLinkagePanel schema={schema} onChange={linkage => api.getState().patchSchema({ linkage })} />;
}

function setup(linkage?: FieldLinkage): FormEditorStoreApi {
  let captured: FormEditorStoreApi | null = null;

  render(
    <ConfigProvider>
      <FormEditorStoreProvider initialState={{ schema: makeSchema(linkage) }}>
        <Harness
          onReady={api => {
            captured = api;
          }}
        />
      </FormEditorStoreProvider>
    </ConfigProvider>
  );

  if (!captured) {
    throw new Error("Form store API was not captured");
  }

  return captured;
}

beforeEach(() => {
  vi.spyOn(globalThis, "matchMedia").mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  } as unknown as MediaQueryList));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FormLinkagePanel", () => {
  it("renders compact rows and offers only effect actions in the rule dialog", async () => {
    const user = userEvent.setup();
    setup({
      rules: [
        {
          id: "R1",
          trigger: { kind: "load" },
          actions: [
            {
              id: "A1",
              type: "alert",
              message: { kind: "literal", value: "hi" }
            }
          ]
        }
      ]
    });

    expect(screen.getByText("表单加载时")).toBeInTheDocument();
    expect(screen.getByText("提示消息 · 信息 · hi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "编辑规则 1" }));
    const dialog = await screen.findByRole("dialog", { name: "规则 1 · 表单事件" });

    // Combobox order in the dialog: trigger kind, then the action's type select.
    const [, actionTypeSelect] = within(dialog).getAllByRole("combobox");
    await user.click(actionTypeSelect as HTMLElement);
    await screen.findByText("设置字段");

    // The form has no self field whose state could be derived — no state
    // actions in the dropdown.
    expect(screen.queryByText("显示")).not.toBeInTheDocument();
    expect(screen.queryByText("赋值")).not.toBeInTheDocument();
  });

  it("adds a form-scope rule only on confirm and keeps consecutive saves as separate undo steps", async () => {
    const user = userEvent.setup();
    const api = setup();

    await user.click(screen.getByRole("button", { name: /新建事件规则/ }));
    let dialog = await screen.findByRole("dialog", { name: "新建事件规则" });
    expect(api.getState().schema.linkage).toBeUndefined();

    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "新建事件规则" })).not.toBeInTheDocument();
    });
    expect(api.getState().schema.linkage).toBeUndefined();

    await user.click(screen.getByRole("button", { name: /新建事件规则/ }));
    dialog = await screen.findByRole("dialog", { name: "新建事件规则" });
    await user.click(within(dialog).getByRole("button", { name: "确定" }));

    expect(api.getState().schema.linkage?.rules).toHaveLength(1);
    expect(api.getState().schema.linkage?.rules?.[0]?.trigger.kind).toBe("condition");
    expect(api.getState().past).toHaveLength(1);

    // Duplicating creates a second distinct undo step.
    await user.click(screen.getByRole("button", { name: "复制规则 1" }));
    expect(api.getState().schema.linkage?.rules).toHaveLength(2);
    expect(api.getState().past).toHaveLength(2);

    act(() => {
      api.getState().undo();
    });
    expect(api.getState().schema.linkage?.rules).toHaveLength(1);
  });

  it("shows an issue marker on the row and live draft diagnostics inside the dialog", async () => {
    const user = userEvent.setup();
    setup({
      rules: [
        {
          id: "R1",
          trigger: { kind: "load" },
          actions: [
            {
              id: "A1",
              type: "set_variable",
              variable: "",
              value: { kind: "literal", value: "1" }
            }
          ]
        }
      ]
    });

    expect(screen.getByText("1 项问题")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "编辑规则 1" }));
    const dialog = await screen.findByRole("dialog", { name: "规则 1 · 表单事件" });

    expect(within(dialog).getByText("步骤 1：尚未填写目标变量名")).toBeInTheDocument();

    // Typing a variable name clears the draft diagnostic live before 确定.
    await user.type(within(dialog).getByPlaceholderText("变量名"), "flag");
    await waitFor(() => {
      expect(within(dialog).queryByText("步骤 1：尚未填写目标变量名")).not.toBeInTheDocument();
    });
  });
});
