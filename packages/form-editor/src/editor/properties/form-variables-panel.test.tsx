import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FieldLinkage, FormSchema, FormVariable } from "../../types";

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "@vef-framework-react/components";
import { useEffect } from "react";

import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { FormVariablesPanel } from "./form-variables-panel";

function makeSchema(variables: FormVariable[], linkage?: FieldLinkage): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    ...(variables.length > 0) && { variables },
    ...linkage && { linkage },
    presentations: { pc: { children: [] } }
  };
}

interface HarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

function Harness({ onReady }: HarnessProps): ReactElement {
  const api = useFormEditorStoreApi();

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return <FormVariablesPanel title="表单变量" />;
}

function setup(variables: FormVariable[] = [], linkage?: FieldLinkage): FormEditorStoreApi {
  let captured: FormEditorStoreApi | null = null;

  render(
    <ConfigProvider>
      <FormEditorStoreProvider initialState={{ schema: makeSchema(variables, linkage) }}>
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

function storeVariables(api: FormEditorStoreApi): FormVariable[] {
  return api.getState().schema.variables ?? [];
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("form variables panel", () => {
  it("renders compact rows showing name, type badge, and default value", () => {
    setup([
      {
        id: "v1",
        name: "rate",
        type: "number",
        defaultValue: 3.15
      },
      {
        id: "v2",
        name: "flag",
        type: "boolean",
        defaultValue: false
      },
      {
        id: "v3",
        name: "memo",
        type: "string"
      }
    ]);

    expect(screen.getByText("rate")).toBeInTheDocument();
    expect(screen.getByText("数字")).toBeInTheDocument();
    expect(screen.getByText("默认：3.15")).toBeInTheDocument();

    expect(screen.getByText("flag")).toBeInTheDocument();
    expect(screen.getByText("布尔")).toBeInTheDocument();
    expect(screen.getByText("默认：否")).toBeInTheDocument();

    expect(screen.getByText("memo")).toBeInTheDocument();
    expect(screen.getByText("无默认值")).toBeInTheDocument();
  });

  describe("creating and validating in modal", () => {
    it("opens a blank modal and validates name grammar, uniqueness, and number/JSON defaults without losing input", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "existing",
          type: "string"
        }
      ]);

      await user.click(screen.getByRole("button", { name: "新增变量" }));

      const dialog = await screen.findByRole("dialog", { name: "新增变量" });

      // Empty name blocked.
      await user.click(within(dialog).getByRole("button", { name: "确定" }));
      expect(within(dialog).getByRole("alert")).toHaveTextContent("请输入变量名");

      // Digit-leading name rejected with inline guidance.
      const nameInput = within(dialog).getByLabelText(/变量名/);

      await user.type(nameInput, "1total");
      expect(within(dialog).getByRole("alert")).toHaveTextContent("不能以数字开头");

      // Duplicate name rejected.
      await user.clear(nameInput);
      await user.type(nameInput, "existing");
      expect(within(dialog).getByRole("alert")).toHaveTextContent("已存在同名变量");

      // Valid name + invalid number default keeps the modal open with input preserved.
      await user.clear(nameInput);
      await user.type(nameInput, "total1");
      await user.click(within(dialog).getByText("数字"));

      const defaultInput = within(dialog).getByLabelText("默认值");

      await user.type(defaultInput, "abc");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(within(dialog).getByRole("alert")).toHaveTextContent("请输入有效的数字");
      expect(defaultInput).toHaveValue("abc");
      expect(storeVariables(api)).toHaveLength(1);

      // Fix number to decimal 3.15 and save.
      await user.clear(defaultInput);
      await user.type(defaultInput, "3.15");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(storeVariables(api)).toHaveLength(2);
      expect(storeVariables(api)[1]).toMatchObject({
        name: "total1",
        type: "number",
        defaultValue: 3.15
      });
    });

    it("parses valid JSON defaults and rejects invalid JSON", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "config",
          type: "json"
        }
      ]);

      await user.click(screen.getByRole("button", { name: "编辑变量 config" }));

      const dialog = await screen.findByRole("dialog", { name: "编辑变量" });
      const textarea = within(dialog).getByLabelText("默认值");

      await user.type(textarea, "{{bad");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(within(dialog).getByRole("alert")).toHaveTextContent("请输入合法的 JSON");

      await user.clear(textarea);
      await user.type(textarea, "{{\"a\": 1}");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(storeVariables(api)[0]?.defaultValue).toEqual({ a: 1 });
    });

    it("seeds concrete false when switching to boolean and lets the user toggle it", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "flag",
          type: "string"
        }
      ]);

      await user.click(screen.getByRole("button", { name: "编辑变量 flag" }));

      const dialog = await screen.findByRole("dialog", { name: "编辑变量" });

      await user.click(within(dialog).getByText("布尔"));
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(storeVariables(api)[0]).toMatchObject({ type: "boolean", defaultValue: false });

      await user.click(screen.getByRole("button", { name: "编辑变量 flag" }));

      const reopened = await screen.findByRole("dialog", { name: "编辑变量" });

      await user.click(within(reopened).getByText("是"));
      await user.click(within(reopened).getByRole("button", { name: "确定" }));

      expect(storeVariables(api)[0]?.defaultValue).toBe(true);
    });
  });

  describe("renaming, dirty close, duplicating, and deleting", () => {
    it("atomically renames linkage references and updates default value in one undo step", async () => {
      const user = userEvent.setup();
      const linkage: FieldLinkage = {
        rules: [
          {
            id: "R1",
            trigger: { kind: "load" },
            actions: [
              {
                id: "A1",
                type: "set_variable",
                variable: "total",
                value: { kind: "literal", value: "0" }
              }
            ]
          }
        ]
      };
      const api = setup([
        {
          id: "v1",
          name: "total",
          type: "number",
          defaultValue: 0
        }
      ], linkage);

      await user.click(screen.getByRole("button", { name: "编辑变量 total" }));

      const dialog = await screen.findByRole("dialog", { name: "编辑变量" });
      const nameInput = within(dialog).getByLabelText(/变量名/);
      const defaultInput = within(dialog).getByLabelText("默认值");

      await user.clear(nameInput);
      await user.type(nameInput, "sum");
      await user.clear(defaultInput);
      await user.type(defaultInput, "42");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(storeVariables(api)[0]).toMatchObject({ name: "sum", defaultValue: 42 });
      expect(api.getState().schema.linkage?.rules?.[0]?.actions?.[0]).toMatchObject({
        type: "set_variable",
        variable: "sum"
      });
      expect(api.getState().past).toHaveLength(1);

      // Single undo restores both the variable and the linkage action reference.
      act(() => {
        api.getState().undo();
      });

      expect(storeVariables(api)[0]).toMatchObject({ name: "total", defaultValue: 0 });
      expect(api.getState().schema.linkage?.rules?.[0]?.actions?.[0]).toMatchObject({
        type: "set_variable",
        variable: "total"
      });
    });

    it("asks confirmation before discarding dirty edits on cancel", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "tax",
          type: "string"
        }
      ]);

      await user.click(screen.getByRole("button", { name: "编辑变量 tax" }));

      const dialog = await screen.findByRole("dialog", { name: "编辑变量" });

      await user.type(within(dialog).getByLabelText("默认值"), "0.1");
      await user.click(within(dialog).getByRole("button", { name: "取消" }));

      expect(await screen.findByText("关闭后本次修改将不会保存。")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "继续编辑" }));
      await waitFor(() => {
        expect(screen.queryByText("关闭后本次修改将不会保存。")).not.toBeInTheDocument();
      });

      expect(within(dialog).getByLabelText("默认值")).toHaveValue("0.1");

      await user.click(within(dialog).getByRole("button", { name: "取消" }));
      expect(await screen.findByText("关闭后本次修改将不会保存。")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "放弃修改" }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "编辑变量" })).not.toBeInTheDocument();
      });
      expect(storeVariables(api)[0]?.defaultValue).toBeUndefined();
    });

    it("duplicates a variable with a unique identifier name", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "tax",
          type: "number",
          defaultValue: 5
        }
      ]);

      await user.click(screen.getByRole("button", { name: "复制变量 tax" }));

      expect(storeVariables(api)).toHaveLength(2);
      expect(storeVariables(api)[1]).toMatchObject({
        name: "tax_2",
        type: "number",
        defaultValue: 5
      });
    });

    it("removes named and unnamed variables alike", async () => {
      const user = userEvent.setup();
      const api = setup([
        {
          id: "v1",
          name: "total",
          type: "string"
        },
        {
          id: "v2",
          name: "",
          type: "string"
        }
      ]);

      await user.click(screen.getByRole("button", { name: "删除变量 total" }));
      expect(storeVariables(api).map(variable => variable.id)).toEqual(["v2"]);

      await user.click(screen.getByRole("button", { name: "删除变量 未命名变量" }));
      expect(storeVariables(api)).toEqual([]);
    });
  });
});
