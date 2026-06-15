import type { CrudState } from "./store";

import { describe, expect, it } from "vitest";

import { act, renderHook } from "../../test-utils";
import { CrudStoreProvider, useCrudStore } from "./store";

interface SearchValues {
  status: "draft" | "published";
  keyword: string;
}

interface SceneFormValues {
  create: { title: string };
  update: { title: string };
  custom: { note: string };
}

type StoreInitialState = Pick<CrudState, "defaultSearchValues" | "sceneDefaultFormValues" | "selectedRowKeys">;

const EMPTY_INITIAL_STATE: StoreInitialState = {
  defaultSearchValues: undefined,
  sceneDefaultFormValues: {},
  selectedRowKeys: []
};

function identityState(state: CrudState): CrudState {
  return state;
}

function selectAll(): typeof identityState {
  return identityState;
}

describe("crud/store", () => {
  describe("initial state", () => {
    it("seeds defaultSearchValues from the StoreProvider initialState", () => {
      const initialState: StoreInitialState = {
        defaultSearchValues: { status: "draft", keyword: "hello" } as SearchValues,
        sceneDefaultFormValues: {} as Partial<SceneFormValues>,
        selectedRowKeys: []
      };

      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={initialState}>{children}</CrudStoreProvider>
      });

      expect(result.current.defaultSearchValues).toEqual({ status: "draft", keyword: "hello" });
    });

    it("starts with formVisible = false and the default scene 'default'", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      expect(result.current.formVisible).toBe(false);
      expect(result.current.formScene).toBe("default");
    });

    it("seeds selectedRowKeys from initialState", () => {
      const initialState: StoreInitialState = {
        ...EMPTY_INITIAL_STATE,
        selectedRowKeys: ["id-1", "id-2"]
      };
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => (
          <CrudStoreProvider initialState={initialState}>
            {children}
          </CrudStoreProvider>
        )
      });

      expect(result.current.selectedRowKeys).toEqual(["id-1", "id-2"]);
    });
  });

  describe("search values", () => {
    it("updates searchValues via setSearchValues", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.setSearchValues({ status: "published", keyword: "search" } as SearchValues);
      });

      expect(result.current.searchValues).toEqual({ status: "published", keyword: "search" });
    });
  });

  describe("advanced search visibility", () => {
    it("starts hidden and toggles via setIsAdvancedSearchVisible", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      expect(result.current.isAdvancedSearchVisible).toBe(false);

      act(() => {
        result.current.setIsAdvancedSearchVisible(true);
      });
      expect(result.current.isAdvancedSearchVisible).toBe(true);

      act(() => {
        result.current.setIsAdvancedSearchVisible(false);
      });
      expect(result.current.isAdvancedSearchVisible).toBe(false);
    });
  });

  describe("scene form", () => {
    it("opens the form with the default title resolved from the scene key 'create'", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.openForm({ scene: "create" });
      });

      expect(result.current.formVisible).toBe(true);
      expect(result.current.formScene).toBe("create");
      expect(result.current.formTitle).toBe("创建");
    });

    it("opens the form with the default title resolved from the scene key 'update'", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.openForm({ scene: "update" });
      });

      expect(result.current.formTitle).toBe("修改");
    });

    it("falls back to the generic title '表单' for unknown scenes", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.openForm({ scene: "custom" });
      });

      expect(result.current.formTitle).toBe("表单");
    });

    it("honors a custom title when provided in openForm", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.openForm({ scene: "create", title: "新建发票" });
      });

      expect(result.current.formTitle).toBe("新建发票");
    });

    it("defaults the formMode to 'modal' when no mode is provided", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.openForm({ scene: "create" });
      });

      expect(result.current.formMode).toBe("modal");
    });

    it("honors the provided formMode when openForm is called with 'drawer'", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.openForm({ scene: "create", mode: "drawer" });
      });

      expect(result.current.formMode).toBe("drawer");
    });

    it("merges scene default values with the provided values when opening the form", () => {
      const initialState: StoreInitialState = {
        ...EMPTY_INITIAL_STATE,
        sceneDefaultFormValues: {
          create: { title: "from-defaults" }
        } as Partial<SceneFormValues>
      };

      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={initialState}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.openForm({ scene: "create", values: { title: "from-call" } });
      });

      expect(result.current.defaultFormValues).toEqual({ title: "from-call" });
    });

    it("closes the form via closeForm", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.openForm({ scene: "create" });
      });
      expect(result.current.formVisible).toBe(true);

      act(() => {
        result.current.closeForm();
      });
      expect(result.current.formVisible).toBe(false);
    });
  });

  describe("selection", () => {
    it("updates selectedRowKeys via setSelectedRowKeys", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.setSelectedRowKeys(["a", "b", "c"]);
      });

      expect(result.current.selectedRowKeys).toEqual(["a", "b", "c"]);
    });

    it("updates selectedRows via setSelectedRows", () => {
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={EMPTY_INITIAL_STATE}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.setSelectedRows([{ id: 1 }, { id: 2 }]);
      });

      expect(result.current.selectedRows).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("clears both selectedRowKeys and selectedRows via clearSelection", () => {
      const initialState: StoreInitialState = {
        ...EMPTY_INITIAL_STATE,
        selectedRowKeys: ["a"]
      };
      const { result } = renderHook(() => useCrudStore(selectAll()), {
        wrapper: ({ children }) => <CrudStoreProvider initialState={initialState}>{children}</CrudStoreProvider>
      });

      act(() => {
        result.current.setSelectedRowKeys(["a", "b"]);
        result.current.setSelectedRows([{ id: 1 }, { id: 2 }]);
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedRowKeys).toEqual([]);
      expect(result.current.selectedRows).toEqual([]);
    });
  });
});
