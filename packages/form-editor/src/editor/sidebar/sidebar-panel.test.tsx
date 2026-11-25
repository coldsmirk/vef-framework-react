import type * as ComponentsModule from "@vef-framework-react/components";
import type { ScrollAreaProps } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema } from "../../types";
import type { EditorLayoutMode } from "../editor-layout-context";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "@vef-framework-react/components";
import { useEffect } from "react";

import { createDefaultRegistry } from "../../engine/registry/defaults";
import { RegistryProvider } from "../../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { EditorLayoutProvider } from "../editor-layout-context";
import { SidebarPanel } from "./sidebar-panel";

vi.mock("@vef-framework-react/components", async importOriginal => {
  const actual = await importOriginal<typeof ComponentsModule>();

  return {
    ...actual,
    ScrollArea: ({ children, scrollbars }: ScrollAreaProps) => (
      <div data-scrollbars={scrollbars} data-testid="sidebar-scroll-area">
        {children}
      </div>
    )
  };
});

function makeSchema(): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: [
          {
            id: "Field_1",
            type: "textfield",
            key: "name",
            label: "姓名"
          }
        ]
      }
    }
  };
}

interface SidebarHarnessProps {
  onReady: (api: FormEditorStoreApi) => void;
}

function SidebarHarness({ onReady }: SidebarHarnessProps): ReactElement {
  const api = useFormEditorStoreApi();

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return <SidebarPanel />;
}

function setupSidebar(layout: EditorLayoutMode = "docked", schema: FormSchema = makeSchema()): FormEditorStoreApi {
  let storeApi: FormEditorStoreApi | null = null;

  render(
    <ConfigProvider>
      <FormEditorStoreProvider initialState={{ schema }}>
        <RegistryProvider registries={{ pc: createDefaultRegistry(), mobile: createDefaultRegistry() }}>
          <EditorLayoutProvider value={layout}>
            <SidebarHarness onReady={nextApi => {
              storeApi = nextApi;
            }}
            />
          </EditorLayoutProvider>
        </RegistryProvider>
      </FormEditorStoreProvider>
    </ConfigProvider>
  );

  if (!storeApi) {
    throw new Error("Form store API was not captured");
  }

  return storeApi;
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

describe("SidebarPanel", () => {
  it("renders the palette tab by default with a vertical-only scroll area", () => {
    setupSidebar();

    expect(screen.getByRole("tab", { name: "组件" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("sidebar-scroll-area")).toHaveAttribute("data-scrollbars", "vertical");
    expect(screen.getByPlaceholderText("搜索组件…")).toBeInTheDocument();
  });

  it("mounts only the active tab content when switching between 组件, 大纲, and 数据", async () => {
    const user = userEvent.setup();
    const storeApi = setupSidebar();

    expect(screen.queryByText("姓名")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新增数据源/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /大纲/ }));

    expect(storeApi.getState().sidebarTab).toBe("outline");
    expect(screen.getByText("姓名")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("搜索组件…")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新增数据源/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /数据/ }));

    expect(storeApi.getState().sidebarTab).toBe("data");
    expect(screen.getByRole("button", { name: /新增数据源/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /新增变量/ })).toBeInTheDocument();
    expect(screen.queryByText("姓名")).not.toBeInTheDocument();
  });

  it("renders data sources before variables on the 数据 tab and commits modal creations to the schema", async () => {
    const user = userEvent.setup();
    const storeApi = setupSidebar();

    await user.click(screen.getByRole("tab", { name: /数据/ }));

    const dataSourcesHeading = screen.getByText("数据源");
    const variablesHeading = screen.getByText("变量");

    expect(dataSourcesHeading.compareDocumentPosition(variablesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /新增数据源/ }));
    const dsDialog = await screen.findByRole("dialog", { name: "新增数据源" });

    await user.type(within(dsDialog).getByLabelText(/名称/), "城市");
    await user.click(within(dsDialog).getByRole("button", { name: "确定" }));

    await user.click(screen.getByRole("button", { name: /新增变量/ }));
    const varDialog = await screen.findByRole("dialog", { name: "新增变量" });

    await user.type(within(varDialog).getByLabelText(/变量名/), "total");
    await user.click(within(varDialog).getByRole("button", { name: "确定" }));

    expect(storeApi.getState().schema.dataSources).toHaveLength(1);
    expect(storeApi.getState().schema.variables).toHaveLength(1);
  });

  it("opens the target data source edit modal when navigated via requestDataItemEdit", async () => {
    const schema: FormSchema = {
      ...makeSchema(),
      dataSources: [
        {
          id: "DataSource_1",
          name: "部门",
          kind: "remote",
          request: { resource: "", action: "" }
        }
      ]
    };
    const storeApi = setupSidebar("docked", schema);

    expect(storeApi.getState().sidebarTab).toBe("palette");

    act(() => {
      storeApi.getState().requestDataItemEdit({ kind: "dataSource", id: "DataSource_1" });
    });

    expect(storeApi.getState().sidebarTab).toBe("data");

    const dialog = await screen.findByRole("dialog", { name: "编辑数据源" });

    expect(within(dialog).getByLabelText(/名称/)).toHaveValue("部门");
    expect(storeApi.getState().pendingDataEdit).toBeNull();
  });

  it("selects a node from the 大纲 tab", async () => {
    const user = userEvent.setup();
    const storeApi = setupSidebar();

    await user.click(screen.getByRole("tab", { name: /大纲/ }));
    await user.click(screen.getByText("姓名"));

    expect(storeApi.getState().selectedId).toBe("Field_1");
    expect(storeApi.getState().propertiesTab).toBe("control");
  });

  it("hides in preview mode without resetting local search state", async () => {
    const user = userEvent.setup();
    const storeApi = setupSidebar();

    expect(screen.getByRole("complementary", { name: "侧边栏" })).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("搜索组件…");

    await user.type(searchInput, "文本");

    expect(searchInput).toHaveValue("文本");

    act(() => {
      storeApi.getState().setViewMode("preview");
    });

    expect(screen.queryByRole("complementary", { name: "侧边栏" })).not.toBeInTheDocument();

    act(() => {
      storeApi.getState().setViewMode("edit");
    });

    expect(screen.getByRole("complementary", { name: "侧边栏" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("搜索组件…")).toHaveValue("文本");
  });

  describe("search", () => {
    it("filters items to the keyword and forces matching groups open", async () => {
      const user = userEvent.setup();
      setupSidebar();

      await user.type(screen.getByPlaceholderText("搜索组件…"), "文本框");

      expect(screen.getByRole("button", { name: "文本框" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "数字" })).not.toBeInTheDocument();
    });

    it("matches by type id as well as display name", async () => {
      const user = userEvent.setup();
      setupSidebar();

      await user.type(screen.getByPlaceholderText("搜索组件…"), "textarea");

      expect(screen.getByRole("button", { name: "多行文本" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "文本框" })).not.toBeInTheDocument();
    });

    it("shows the empty state when nothing matches", async () => {
      const user = userEvent.setup();
      setupSidebar();

      await user.type(screen.getByPlaceholderText("搜索组件…"), "zzzz");

      expect(screen.getByText("没有匹配的组件")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "文本框" })).not.toBeInTheDocument();
    });
  });

  describe("drawer layout", () => {
    it("renders the icon rail without search when 组件 is active", () => {
      setupSidebar("drawer");

      expect(screen.getByTestId("sidebar-scroll-area")).toHaveAttribute("data-scrollbars", "vertical");
      expect(screen.queryByPlaceholderText("搜索组件…")).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "大纲" })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "数据" })).not.toBeInTheDocument();
    });

    it("opens 大纲 and 数据 overlays from the rail and closes back to 组件", async () => {
      const user = userEvent.setup();
      const storeApi = setupSidebar("drawer");

      await user.click(screen.getByRole("tab", { name: "大纲" }));

      const outlineOverlay = screen.getByRole("region", { name: "大纲" });

      expect(within(outlineOverlay).getByText("姓名")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "数据" }));

      expect(screen.queryByRole("region", { name: "大纲" })).not.toBeInTheDocument();

      const dataOverlay = screen.getByRole("region", { name: "数据" });

      expect(within(dataOverlay).getByRole("button", { name: /新增数据源/ })).toBeInTheDocument();

      await user.click(within(dataOverlay).getByRole("button", { name: "收起侧边栏" }));

      expect(storeApi.getState().sidebarTab).toBe("palette");
      expect(screen.queryByRole("region", { name: "数据" })).not.toBeInTheDocument();
    });

    it("toggles the active overlay closed when its rail tab is clicked again", async () => {
      const user = userEvent.setup();
      const storeApi = setupSidebar("drawer");

      await user.click(screen.getByRole("tab", { name: "大纲" }));
      expect(screen.getByRole("region", { name: "大纲" })).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "大纲" }));

      expect(storeApi.getState().sidebarTab).toBe("palette");
      expect(screen.queryByRole("region", { name: "大纲" })).not.toBeInTheDocument();
    });

    it("hides both the rail and any open overlay in preview mode", async () => {
      const user = userEvent.setup();
      const storeApi = setupSidebar("drawer");

      await user.click(screen.getByRole("tab", { name: "数据" }));
      expect(screen.getByRole("region", { name: "数据" })).toBeInTheDocument();

      act(() => {
        storeApi.getState().setViewMode("preview");
      });

      expect(screen.queryByRole("complementary", { name: "侧边栏" })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "数据" })).not.toBeInTheDocument();
    });

    it("opens the data overlay and edit modal when navigated to a data source in drawer layout", async () => {
      const schema: FormSchema = {
        ...makeSchema(),
        dataSources: [
          {
            id: "DataSource_1",
            name: "部门",
            kind: "static",
            options: [{ label: "研发部", value: "rd" }]
          }
        ]
      };
      const storeApi = setupSidebar("drawer", schema);

      act(() => {
        storeApi.getState().requestDataItemEdit({ kind: "dataSource", id: "DataSource_1" });
      });

      expect(screen.getByRole("region", { name: "数据" })).toBeInTheDocument();

      const dialog = await screen.findByRole("dialog", { name: "编辑数据源" });

      expect(within(dialog).getByLabelText(/名称/)).toHaveValue("部门");
    });
  });
});
