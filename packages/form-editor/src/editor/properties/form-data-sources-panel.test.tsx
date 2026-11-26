import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { DataSourceApi, FormDataSource, FormSchema } from "../../types";

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "@vef-framework-react/components";
import { useEffect } from "react";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { createDefaultMobileRegistry } from "../../engine/registry/defaults-mobile";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { DataSourceApisProvider } from "../data-source-apis";
import { FormDataSourcesPanel } from "./form-data-sources-panel";

const CATALOG_APIS: DataSourceApi[] = [
  {
    label: "部门列表",
    resource: "sys/department",
    action: "find_options",
    params: [
      {
        name: "orgId",
        label: "机构",
        required: true
      }
    ]
  },
  {
    label: "用户列表",
    resource: "sys/user",
    action: "find_options"
  }
];

function makeSchema(dataSources: FormDataSource[], extra?: Partial<FormSchema>): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    ...(dataSources.length > 0) && { dataSources },
    presentations: { pc: { children: [] } },
    ...extra
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

  return <FormDataSourcesPanel />;
}

const REGISTRIES = {
  pc: createDefaultRegistry(),
  mobile: createDefaultMobileRegistry()
};

function setup(
  dataSources: FormDataSource[] = [],
  options?: { apis?: DataSourceApi[]; schemaExtra?: Partial<FormSchema> }
): FormEditorStoreApi {
  let captured: FormEditorStoreApi | null = null;

  render(
    <ConfigProvider>
      <FormEditorStoreProvider initialState={{ schema: makeSchema(dataSources, options?.schemaExtra) }}>
        <RegistryProvider registries={REGISTRIES}>
          <DataSourceApisProvider apis={options?.apis}>
            <Harness
              onReady={api => {
                captured = api;
              }}
            />
          </DataSourceApisProvider>
        </RegistryProvider>
      </FormEditorStoreProvider>
    </ConfigProvider>
  );

  if (!captured) {
    throw new Error("Form store API was not captured");
  }

  return captured;
}

function storeSources(api: FormEditorStoreApi): FormDataSource[] {
  return api.getState().schema.dataSources ?? [];
}

function staticSource(overrides?: Partial<Extract<FormDataSource, { kind: "static" }>>): FormDataSource {
  return {
    id: "ds1",
    name: "城市",
    kind: "static",
    options: [{ label: "北京", value: "bj" }],
    ...overrides
  };
}

beforeEach(() => {
  // Disable antd Modal CSS close motion in jsdom (which never fires
  // `animationend`), matching VEF's ConfigProvider reduced-motion path.
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

describe("form data sources panel", () => {
  it("binds a request parameter to a form field through the reference picker", async () => {
    const user = userEvent.setup();

    setup([], {
      apis: CATALOG_APIS,
      schemaExtra: {
        dataSources: [
          {
            id: "ds1",
            name: "部门",
            kind: "remote",
            request: {
              resource: "sys/department",
              action: "find_options",
              params: { orgId: { kind: "reference", path: "" } }
            }
          }
        ],
        presentations: {
          pc: {
            children: [
              {
                id: "Field_org",
                type: "textfield",
                key: "org",
                label: "机构"
              }
            ]
          }
        }
      }
    });

    await user.click(screen.getByRole("button", { name: "编辑数据源 部门" }));

    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByText("选择引用数据"));

    expect(await screen.findByText("机构 · org")).toBeInTheDocument();
  });

  describe("compact list rendering", () => {
    it("renders empty state when no data sources exist", () => {
      setup();

      expect(screen.getByText("暂无数据源")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "新增数据源" })).toBeInTheDocument();
    });

    it("renders unnamed fallback, static/catalog/custom/incomplete summaries, and usage counts", () => {
      setup(
        [
          staticSource(),
          {
            id: "ds2",
            name: "用户目录",
            kind: "remote",
            request: { resource: "sys/user", action: "find_options" }
          },
          {
            id: "ds3",
            name: "自定义仓库",
            kind: "remote",
            request: { resource: "inv/warehouse", action: "list" }
          },
          {
            id: "ds4",
            name: "",
            kind: "remote",
            request: { resource: "", action: "" }
          }
        ],
        {
          apis: CATALOG_APIS,
          schemaExtra: {
            presentations: {
              pc: {
                children: [
                  {
                    id: "f1",
                    type: "select",
                    key: "city",
                    label: "城市字段",
                    dataSource: { kind: "ref", dataSourceId: "ds1" }
                  },
                  {
                    id: "sub1",
                    type: "subform",
                    variant: "table",
                    key: "matrix",
                    label: "矩阵明细",
                    rows: {
                      mode: "fixed",
                      itemKey: "item",
                      source: { kind: "ref", dataSourceId: "ds1" }
                    },
                    template: [
                      {
                        id: "f2",
                        type: "textfield",
                        key: "note",
                        label: "备注"
                      }
                    ]
                  }
                ]
              }
            },
            linkage: {
              rules: [
                {
                  id: "r1",
                  trigger: { kind: "load" },
                  actions: [{ type: "refresh_data_source", dataSourceId: "ds1" }]
                }
              ]
            }
          }
        }
      );

      expect(screen.getByText("城市")).toBeInTheDocument();
      expect(screen.getByText("静态 · 1 项")).toBeInTheDocument();
      expect(screen.getByText("3 处使用")).toBeInTheDocument();

      expect(screen.getByText("用户目录")).toBeInTheDocument();
      expect(screen.getByText("接口 · 用户列表")).toBeInTheDocument();

      expect(screen.getByText("自定义仓库")).toBeInTheDocument();
      expect(screen.getByText("接口 · inv/warehouse / list")).toBeInTheDocument();

      expect(screen.getByText("未命名数据源")).toBeInTheDocument();
      const incomplete = screen.getByText("接口 · 未配置");

      expect(incomplete).toHaveAttribute("data-incomplete", "true");
    });

    it("keeps edit, duplicate, and delete as sibling keyboard-accessible buttons", async () => {
      const user = userEvent.setup();

      setup([staticSource()]);

      const editBtn = screen.getByRole("button", { name: "编辑数据源 城市" });
      const duplicateBtn = screen.getByRole("button", { name: "复制数据源 城市" });
      const deleteBtn = screen.getByRole("button", { name: "删除数据源 城市" });

      expect(editBtn.contains(duplicateBtn)).toBe(false);
      expect(editBtn.contains(deleteBtn)).toBe(false);

      editBtn.focus();
      expect(editBtn).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(await screen.findByRole("dialog", { name: "编辑数据源" })).toBeInTheDocument();
    });
  });

  describe("creating in modal", () => {
    it("opens a blank draft modal and writes to the store only on confirm", async () => {
      const user = userEvent.setup();
      const api = setup();

      await user.click(screen.getByRole("button", { name: "新增数据源" }));

      const dialog = await screen.findByRole("dialog", { name: "新增数据源" });

      // Nothing persisted yet while drafting.
      expect(storeSources(api)).toHaveLength(0);

      await user.type(within(dialog).getByLabelText(/名称/), "审批状态");
      await user.click(within(dialog).getByRole("button", { name: /添加选项/ }));
      await user.type(within(dialog).getByPlaceholderText("标签"), "通过");
      await user.clear(within(dialog).getByPlaceholderText("值"));
      await user.type(within(dialog).getByPlaceholderText("值"), "approved");

      expect(storeSources(api)).toHaveLength(0);

      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      const sources = storeSources(api);

      expect(sources).toHaveLength(1);
      expect(sources[0]).toMatchObject({
        name: "审批状态",
        kind: "static",
        options: [{ label: "通过", value: "approved" }]
      });
      expect(api.getState().past).toHaveLength(1);
    });

    it("shows inline errors for blank or duplicate names without discarding draft content", async () => {
      const user = userEvent.setup();
      const api = setup([staticSource()]);

      await user.click(screen.getByRole("button", { name: "新增数据源" }));

      const dialog = await screen.findByRole("dialog", { name: "新增数据源" });

      // Add an option first, then try to confirm with an empty name.
      await user.click(within(dialog).getByRole("button", { name: /添加选项/ }));
      await user.type(within(dialog).getByPlaceholderText("标签"), "上海");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(within(dialog).getByRole("alert")).toHaveTextContent("请输入数据源名称");
      expect(within(dialog).getByPlaceholderText("标签")).toHaveValue("上海");
      expect(storeSources(api)).toHaveLength(1);

      // Type a duplicate name — inline error appears and draft option stays intact.
      await user.type(within(dialog).getByLabelText(/名称/), "城市");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(within(dialog).getByRole("alert")).toHaveTextContent("已存在同名数据源");
      expect(within(dialog).getByPlaceholderText("标签")).toHaveValue("上海");
      expect(storeSources(api)).toHaveLength(1);

      // Fix the name and confirm — preserved option commits cleanly.
      const nameInput = within(dialog).getByLabelText(/名称/);

      await user.clear(nameInput);
      await user.type(nameInput, "省份");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(storeSources(api)).toHaveLength(2);
      expect(storeSources(api)[1]).toMatchObject({
        name: "省份",
        options: [{ label: "上海", value: "item_1" }]
      });
    });
  });

  describe("editing in modal", () => {
    it("commits multiple draft edits as one undo step and keeps consecutive saves as separate undo steps", async () => {
      const user = userEvent.setup();
      const api = setup([
        staticSource(),
        {
          id: "ds2",
          name: "部门",
          kind: "remote",
          request: { resource: "org", action: "" }
        }
      ]);

      // Edit 1: rename + append option in one modal session.
      await user.click(screen.getByRole("button", { name: "编辑数据源 城市" }));

      let dialog = await screen.findByRole("dialog", { name: "编辑数据源" });
      const nameInput = within(dialog).getByLabelText(/名称/);

      await user.clear(nameInput);
      await user.type(nameInput, "主要城市");
      await user.click(within(dialog).getByRole("button", { name: /添加选项/ }));
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(storeSources(api)[0]).toMatchObject({
        name: "主要城市",
        options: [{ label: "北京", value: "bj" }, { label: "", value: "item_1" }]
      });
      expect(api.getState().past).toHaveLength(1);

      // Edit 2: edit remote action in a second modal session.
      await user.click(screen.getByRole("button", { name: "编辑数据源 部门" }));
      dialog = await screen.findByRole("dialog", { name: "编辑数据源" });
      await user.type(within(dialog).getByRole("textbox", { name: "动作" }), "find_options");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(storeSources(api)[1]).toMatchObject({
        kind: "remote",
        request: { resource: "org", action: "find_options" }
      });
      expect(api.getState().past).toHaveLength(2);

      // Undo once reverts only Edit 2; Edit 1 remains.
      act(() => {
        api.getState().undo();
      });

      expect(storeSources(api)[1]).toMatchObject({ request: { resource: "org", action: "" } });
      expect(storeSources(api)[0]).toMatchObject({ name: "主要城市" });
    });

    it("closes without confirmation when clean, and asks confirmation when dirty", async () => {
      const user = userEvent.setup();
      const api = setup([staticSource()]);

      // Clean close — no confirmation dialog opens.
      await user.click(screen.getByRole("button", { name: "编辑数据源 城市" }));
      let dialog = await screen.findByRole("dialog", { name: "编辑数据源" });
      await user.click(within(dialog).getByRole("button", { name: "取消" }));

      expect(screen.queryByText("放弃未保存的修改？")).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "编辑数据源" })).not.toBeInTheDocument();
      });

      // Dirty close declined — modal stays open with edits intact.
      await user.click(screen.getByRole("button", { name: "编辑数据源 城市" }));
      dialog = await screen.findByRole("dialog", { name: "编辑数据源" });
      await user.type(within(dialog).getByLabelText(/名称/), "列表");
      await user.click(within(dialog).getByRole("button", { name: "取消" }));

      expect(await screen.findByText("关闭后本次修改将不会保存。")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "继续编辑" }));
      await waitFor(() => {
        expect(screen.queryByText("关闭后本次修改将不会保存。")).not.toBeInTheDocument();
      });

      expect(within(dialog).getByLabelText(/名称/)).toHaveValue("城市列表");

      // Dirty close accepted — modal closes and store stays untouched.
      await user.click(within(dialog).getByRole("button", { name: "取消" }));
      expect(await screen.findByText("关闭后本次修改将不会保存。")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "放弃修改" }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "编辑数据源" })).not.toBeInTheDocument();
      });
      expect(storeSources(api)[0]).toEqual(staticSource());
    });

    it("reuses kind-switch confirmation inside the modal", async () => {
      const user = userEvent.setup();
      const api = setup([staticSource()]);

      await user.click(screen.getByRole("button", { name: "编辑数据源 城市" }));

      const dialog = await screen.findByRole("dialog", { name: "编辑数据源" });

      await user.click(within(dialog).getByText("远程请求"));

      // Switching a configured static source waits behind Popconfirm.
      expect(within(dialog).queryByRole("textbox", { name: "资源" })).not.toBeInTheDocument();

      await user.click(await screen.findByRole("button", { name: "切换" }));
      expect(within(dialog).getByRole("textbox", { name: "资源" })).toBeInTheDocument();

      await user.type(within(dialog).getByRole("textbox", { name: "资源" }), "geo/city");
      await user.type(within(dialog).getByRole("textbox", { name: "动作" }), "list");
      await user.click(within(dialog).getByRole("button", { name: "确定" }));

      expect(storeSources(api)[0]).toEqual({
        id: "ds1",
        name: "城市",
        kind: "remote",
        request: { resource: "geo/city", action: "list" }
      });
    });
  });

  describe("duplicating and deleting", () => {
    it("duplicates a data source with a unique copy name right after the original", async () => {
      const user = userEvent.setup();
      const api = setup([staticSource()]);

      await user.click(screen.getByRole("button", { name: "复制数据源 城市" }));

      const sources = storeSources(api);

      expect(sources).toHaveLength(2);
      expect(sources[1]).toMatchObject({
        name: "城市 副本",
        kind: "static",
        options: [{ label: "北京", value: "bj" }]
      });
      expect(sources[1]?.id).not.toBe("ds1");

      // Duplicating again increments the suffix.
      await user.click(screen.getByRole("button", { name: "复制数据源 城市" }));

      expect(storeSources(api).map(item => item.name)).toEqual(["城市", "城市 副本 2", "城市 副本"]);
    });

    it("deletes an unreferenced data source directly and supports undo", async () => {
      const user = userEvent.setup();
      const api = setup([staticSource()]);
      const removeSpy = vi.spyOn(api.getState(), "removeDataSource");

      await user.click(screen.getByRole("button", { name: "删除数据源 城市" }));

      expect(screen.queryByText(/删除数据源「城市」/)).not.toBeInTheDocument();
      expect(removeSpy).toHaveBeenCalledWith("ds1");
      expect(storeSources(api)).toEqual([]);

      act(() => {
        api.getState().undo();
      });

      expect(storeSources(api)).toEqual([staticSource()]);
    });

    it("asks confirmation listing affected fields before deleting a referenced data source", async () => {
      const user = userEvent.setup();
      const api = setup([staticSource()], {
        schemaExtra: {
          presentations: {
            pc: {
              children: [
                {
                  id: "f1",
                  type: "select",
                  key: "city",
                  label: "所在城市",
                  dataSource: { kind: "ref", dataSourceId: "ds1" }
                }
              ]
            }
          }
        }
      });

      await user.click(screen.getByRole("button", { name: "删除数据源 城市" }));

      expect(await screen.findByText(/「所在城市」/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "取消" }));
      await waitFor(() => {
        expect(screen.queryByText(/「所在城市」/)).not.toBeInTheDocument();
      });
      expect(storeSources(api)).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "删除数据源 城市" }));

      expect(await screen.findByText(/「所在城市」/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "删除" }));

      expect(storeSources(api)).toEqual([]);

      // Field reference pruned by removeDataSource and restored by undo.
      const fieldAfter = api.getState().schema.presentations.pc.children[0];

      expect(fieldAfter && "dataSource" in fieldAfter ? fieldAfter.dataSource : undefined).toBeUndefined();

      act(() => {
        api.getState().undo();
      });

      expect(storeSources(api)).toHaveLength(1);
    });
  });

  describe("diagnostic jump", () => {
    it("scrolls the target row into view, clears pendingDataEdit, and opens its modal", async () => {
      const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");
      const api = setup([
        staticSource({ id: "ds1", name: "城市" }),
        staticSource({ id: "ds2", name: "部门" })
      ]);

      act(() => {
        api.getState().requestDataEdit({ kind: "dataSource", id: "ds2" });
      });

      const dialog = await screen.findByRole("dialog", { name: "编辑数据源" });

      expect(within(dialog).getByLabelText(/名称/)).toHaveValue("部门");
      expect(api.getState().pendingDataEdit).toBeNull();
      const rows = screen.getAllByRole("listitem");
      expect(scrollSpy).toHaveBeenCalledWith({ block: "nearest" });
      expect(scrollSpy.mock.contexts).toContain(rows[1]);
    });
  });
});
