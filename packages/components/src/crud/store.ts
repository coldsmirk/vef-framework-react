import type { ApiResult } from "@vef-framework-react/core";
import type { AnyObject, Awaitable, Key } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { Breakpoint, Length } from "../_base";
import type { CrudEvents } from "./event";
import type { CrudFormDrawerConfig, CrudFormMode, CrudFormScene } from "./types";

import { createComponentStore } from "@vef-framework-react/core";
import { createThrowNotImplementedFn, EventEmitter, mergeWith } from "@vef-framework-react/shared";

import { createEventEmitter } from "./event";

/**
 * Options to open a scene form.
 *
 * TScene: the specific scene key to be opened
 * TSceneFormValues: the map type for all scene form values
 */
export interface OpenFormOptions<TScene extends CrudFormScene<TSceneFormValues>, TSceneFormValues extends AnyObject> {
  /**
   * Target scene key to open.
   */
  scene: TScene;
  /**
   * Initial values for the target scene form.
   */
  values?: Partial<TSceneFormValues[TScene]>;
  /**
   * Custom form title. If omitted, a default title will be used.
   */
  title?: ReactNode;
  /**
   * Custom form width. If omitted, a default responsive width will be used.
   */
  width?: Length | Partial<Record<Breakpoint, Length>>;
  /**
   * Form display mode.
   *
   * @default "modal"
   */
  mode?: CrudFormMode;
  /**
   * Drawer-specific configuration when mode is "drawer".
   */
  drawerConfig?: CrudFormDrawerConfig;
}

/**
 * State shape for the Crud component store.
 *
 * TRow: the row model type displayed in the table
 * TSearchValues: the type of the search/filters form values
 * TSceneFormValues: a map of scene key to its form values type
 */
export interface CrudState<
  TRow extends AnyObject = AnyObject,
  TSearchValues extends AnyObject = AnyObject,
  TSceneFormValues extends AnyObject = AnyObject
> {
  /**
   * Internal event bus used for cross-part communication within Crud.
   */
  eventEmitter: EventEmitter<CrudEvents>;
  /**
   * Whether the advanced search panel is visible.
   */
  isAdvancedSearchVisible: boolean;
  /**
   * Toggle the visibility of the advanced search panel.
   */
  setIsAdvancedSearchVisible: (isAdvancedSearchVisible: boolean) => void;
  /**
   * Default search form values (initial state).
   */
  defaultSearchValues?: TSearchValues;
  /**
   * Current basic/advanced search form values.
   */
  searchValues?: TSearchValues;
  /**
   * Update the current search form values.
   */
  setSearchValues: (values?: TSearchValues) => void;
  /**
   * Whether the scene form (create/update or custom) is visible.
   */
  formVisible: boolean;
  /**
   * Current active form scene key.
   */
  formScene: CrudFormScene<TSceneFormValues>;
  /**
   * Title displayed on the scene form.
   */
  formTitle: ReactNode;
  /**
   * Width of the scene form. Can be a fixed length or responsive map by breakpoint.
   */
  formWidth: Length | Partial<Record<Breakpoint, Length>>;
  /**
   * Form display mode (modal or drawer).
   */
  formMode: CrudFormMode;
  /**
   * Drawer-specific configuration when formMode is "drawer".
   */
  drawerConfig?: CrudFormDrawerConfig;
  /**
   * Open the scene form with optional initial values, custom title and width.
   */
  openForm: <const TScene extends CrudFormScene<TSceneFormValues>>(options: OpenFormOptions<TScene, TSceneFormValues>) => void;
  /**
   * Close the scene form.
   */
  closeForm: () => void;
  /**
   * Default form values map for all scenes, usually provided by the component.
   */
  sceneDefaultFormValues: Partial<TSceneFormValues>;
  /**
   * Resolved default values for the currently active scene.
   */
  defaultFormValues: TSceneFormValues[CrudFormScene<TSceneFormValues>];
  /**
   * Delete a single row.
   */
  delete: (row: TRow) => Awaitable<ApiResult<unknown>>;
  /**
   * Delete multiple rows in batch.
   */
  deleteMany: (rows: TRow[]) => Awaitable<ApiResult<unknown>>;
  /**
   * Whether the list query is being fetched.
   */
  isQueryFetching: boolean;
  /**
   * Re-trigger the list query.
   */
  refetchQuery: () => void;
  /**
   * Currently selected row keys.
   */
  selectedRowKeys: Key[];
  /**
   * Update selected row keys.
   */
  setSelectedRowKeys: (selectedRowKeys: Key[]) => void;
  /**
   * Currently selected row models.
   */
  selectedRows: TRow[];
  /**
   * Update selected row models.
   */
  setSelectedRows: (selectedRows: TRow[]) => void;
  /**
   * Clear all selected row keys and row models.
   */
  clearSelection: () => void;
}

const defaultFormTitles: Record<string, string> = {
  create: "创建",
  update: "修改"
};

const defaultFormWidth = {
  xxl: "40vw",
  xl: "50vw",
  lg: "60vw",
  md: "70vw",
  sm: "80vw",
  xs: "90vw",
  xxs: "95vw"
};

export const {
  StoreProvider: CrudStoreProvider,
  useStore: useCrudStore,
  useStoreApi: useCrudStoreApi
} = createComponentStore<CrudState, Pick<CrudState, "defaultSearchValues" | "sceneDefaultFormValues" | "selectedRowKeys">>(
  "Crud",
  set => {
    return {
      eventEmitter: createEventEmitter(),
      setSearchValues: values => {
        set(state => {
          state.searchValues = values;
        });
      },
      isAdvancedSearchVisible: false,
      setIsAdvancedSearchVisible: isAdvancedSearchVisible => {
        set(state => {
          state.isAdvancedSearchVisible = isAdvancedSearchVisible;
        });
      },
      formVisible: false,
      formScene: "default",
      formTitle: defaultFormTitles.create,
      formWidth: defaultFormWidth,
      formMode: "modal",
      drawerConfig: undefined,
      openForm: ({
        scene,
        values,
        title,
        width,
        mode = "modal",
        drawerConfig
      }) => {
        set(state => {
          state.formScene = scene;
          state.formTitle = title || defaultFormTitles[scene] || "表单";
          state.formWidth = width || defaultFormWidth;
          state.formMode = mode;
          state.drawerConfig = drawerConfig;
          state.defaultFormValues = mergeWith(values ?? {}, state.sceneDefaultFormValues[scene] ?? {});
          state.formVisible = true;
        });
      },
      closeForm: () => {
        set(state => {
          state.formVisible = false;
        });
      },
      sceneDefaultFormValues: {},
      defaultFormValues: {},
      delete: createThrowNotImplementedFn("delete"),
      deleteMany: createThrowNotImplementedFn("deleteMany"),
      isQueryFetching: false,
      refetchQuery: createThrowNotImplementedFn("refetchQuery"),
      selectedRowKeys: [],
      setSelectedRowKeys: selectedRowKeys => {
        set(state => {
          state.selectedRowKeys = selectedRowKeys;
        });
      },
      selectedRows: [],
      setSelectedRows: selectedRows => {
        set(state => {
          state.selectedRows = selectedRows;
        });
      },
      clearSelection: () => {
        set(state => {
          state.selectedRowKeys = [];
          state.selectedRows = [];
        });
      }
    };
  },
  {
    storage: "session",
    selector: state => {
      return {
        searchValues: state.searchValues
      };
    }
  }
);
