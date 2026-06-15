import type { ReactElement, ReactNode, Ref, RefObject } from "react";

import type { DeviceRegistries, FormFieldRegistry } from "../engine/registry/form-field-registry";
import type { EditorDeviceMode, EditorViewMode } from "../store/form-store";
import type { DataSourceResolver, ExpressionContext, FormSchema, LinkageEvaluators } from "../types";
import type { ToolbarBrand } from "./toolbar/toolbar";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { DragDropProvider, useDragOperation } from "@vef-framework-react/core";
import { isNullish } from "@vef-framework-react/shared";
import { useEffect, useImperativeHandle, useMemo, useState } from "react";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { createDefaultMobileRegistry } from "../engine/registry/defaults-mobile";
import { DeviceProvider, RegistryProvider } from "../store/engine-provider";
import { FormEditorStoreProvider, useFormEditorStore, useFormEditorStoreApi } from "../store/form-store";
import { Canvas } from "./canvas/canvas";
import { editorSensors, useEditorDragEnd } from "./dnd";
import { EditorLayoutProvider, useEditorLayoutMeasure } from "./editor-layout-context";
import { EditorFooter } from "./footer/footer";
import { FormConfigDrawer } from "./form-config/form-config-drawer";
import { PalettePanel } from "./palette/palette-panel";
import { previewDispatchEffect } from "./preview-effects";
import { PreviewRuntimeProvider } from "./preview-runtime-context";
import { PropertiesPanel } from "./properties/properties-panel";
import { Toolbar } from "./toolbar/toolbar";
import { useEditorShortcuts } from "./use-editor-shortcuts";

const rootCss = css({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  minHeight: 480,
  background: globalCssVars.colorBgLayout,
  color: globalCssVars.colorText,
  fontFamily: globalCssVars.fontFamily,
  // The root is click-focusable (tabIndex -1) so the shell-scoped keyboard
  // shortcuts receive keystrokes; it is a container, not a control, so the
  // focus ring stays off.
  outline: "none"
});

const workspaceCss = css({
  // Anchors the drawer-layout properties overlay (absolute against this box).
  position: "relative",
  flex: 1,
  display: "flex",
  minHeight: 0,
  minWidth: 0,
  background: globalCssVars.colorBgLayout,
  overflow: "hidden"
});

const stageCss = css({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden"
});

const canvasAreaCss = css({
  position: "relative",
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
  // The form-config drawer is positioned absolute against this area so it floats
  // over the canvas's bottom edge but stays above the footer below it.
  overflow: "hidden"
});

/**
 * Imperative handle for host shells (toolbars outside the editor, wizard
 * steps, save buttons). A curated surface — the store's internal shape stays
 * private so it can evolve without breaking hosts.
 */
export interface FormEditorApi {
  getSchema: () => FormSchema;
  /**
   * Replace the schema wholesale (import semantics — the undo timeline
   * resets, exactly like the 导入 dialog).
   */
  setSchema: (schema: FormSchema) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  selectNode: (nodeId: string | null) => void;
  setDevice: (device: EditorDeviceMode) => void;
  setViewMode: (mode: EditorViewMode) => void;
}

export interface FormEditorProviderProps {
  initialSchema?: FormSchema;
  /**
   * Per-device field registries. Each device falls back to {@link registry} (if
   * given) and then to the built-in defaults, so supplying only the device(s)
   * you customize is enough.
   */
  registries?: Partial<DeviceRegistries>;
  /**
   * Shorthand for a registry shared by **both** devices. Ignored for a device
   * that {@link registries} already provides. Prefer {@link registries} when the
   * two devices need different field sets. Note the shorthand also shares one
   * container-chrome set across devices — see `FormFieldRegistry`.
   */
  registry?: FormFieldRegistry;
  /**
   * Overrides for the dynamic linkage evaluators, forwarded to the live preview
   * so a custom JS engine / DSL runs in-designer exactly as it will at runtime.
   */
  evaluators?: LinkageEvaluators;
  /**
   * Host resolver for `remote` option sources, forwarded to the live preview so
   * remote / ref-to-remote data sources actually resolve while designing.
   */
  dataSourceResolver?: DataSourceResolver;
  /**
   * Host expression scope (`$user` / `$node`, variable overrides), forwarded to
   * the live preview so host-context expressions evaluate truthfully.
   */
  expressionContext?: ExpressionContext;
  onSchemaChange?: (schema: FormSchema) => void;
  /**
   * Curated imperative handle — lets a host shell read/replace the schema and
   * drive undo/redo/selection without reaching into the editor's store.
   */
  apiRef?: Ref<FormEditorApi>;
  children: ReactNode;
}

/**
 * Subscribes the host's `onSchemaChange` and exposes the curated
 * {@link FormEditorApi} handle. Lives inside the store provider so both wire
 * against the real store instance.
 */
function HostBridge({ apiRef, onSchemaChange }: Pick<FormEditorProviderProps, "apiRef" | "onSchemaChange">): null {
  const storeApi = useFormEditorStoreApi();

  useEffect(() => {
    if (!onSchemaChange) {
      return;
    }

    return storeApi.subscribe((state, prev) => {
      if (state.schema !== prev.schema) {
        onSchemaChange(state.schema);
      }
    });
  }, [storeApi, onSchemaChange]);

  useImperativeHandle(apiRef, () => {
    return {
      getSchema: () => storeApi.getState().schema,
      setSchema: schema => storeApi.getState().setSchema(schema),
      undo: () => storeApi.getState().undo(),
      redo: () => storeApi.getState().redo(),
      canUndo: () => storeApi.getState().canUndo(),
      canRedo: () => storeApi.getState().canRedo(),
      selectNode: nodeId => storeApi.getState().selectNode(nodeId),
      setDevice: device => storeApi.getState().setDevice(device),
      setViewMode: mode => storeApi.getState().setViewMode(mode)
    };
  }, [storeApi]);

  return null;
}

/**
 * Context root for a form-editor instance: the editor store, the per-device
 * registries, and the preview runtime. Hosts composing their own shell start
 * here; {@link FormEditor} is the pre-composed variant on top of it.
 *
 * `registries` / `registry` and `initialSchema` are honoured only on the first
 * render; updating them afterwards has no effect (editor state is bootstrapped
 * once per mount — use {@link FormEditorApi.setSchema} to replace the schema).
 */
export function FormEditorProvider({
  apiRef,
  children,
  dataSourceResolver,
  evaluators,
  expressionContext,
  initialSchema,
  onSchemaChange,
  registries: registriesProp,
  registry: registryProp
}: FormEditorProviderProps): ReactElement {
  const [registries] = useState<DeviceRegistries>(() => {
    return {
      pc: registriesProp?.pc ?? registryProp ?? createDefaultRegistry(),
      mobile: registriesProp?.mobile ?? registryProp ?? createDefaultMobileRegistry()
    };
  });

  const evaluateExpression = evaluators?.evaluateExpression;
  const evaluateScriptAction = evaluators?.evaluateScriptAction;
  const evaluateAssignExpression = evaluators?.evaluateAssignExpression;
  const dispatchEffect = evaluators?.dispatchEffect;

  // The preview renders host-delegated effects (`alert` / `navigate` / `api_call`)
  // through `previewDispatchEffect` so a designer can see them fire while building
  // a form. A host that supplies its own `dispatchEffect` keeps full control.
  // Depends on the four fixed evaluator slots rather than the object identity,
  // so a host passing an inline `evaluators={{...}}` object does not invalidate
  // the preview runtime context on every render.
  const previewEvaluators = useMemo<LinkageEvaluators>(
    () => {
      return {
        ...evaluateExpression === undefined ? {} : { evaluateExpression },
        ...evaluateScriptAction === undefined ? {} : { evaluateScriptAction },
        ...evaluateAssignExpression === undefined ? {} : { evaluateAssignExpression },
        dispatchEffect: dispatchEffect ?? previewDispatchEffect
      };
    },
    [evaluateExpression, evaluateScriptAction, evaluateAssignExpression, dispatchEffect]
  );

  return (
    <FormEditorStoreProvider initialState={initialSchema ? { schema: initialSchema } : {}}>
      <RegistryProvider registries={registries}>
        <PreviewRuntimeProvider value={{
          dataSourceResolver,
          evaluators: previewEvaluators,
          expressionContext
        }}
        >
          <HostBridge apiRef={apiRef} onSchemaChange={onSchemaChange} />
          {children}
        </PreviewRuntimeProvider>
      </RegistryProvider>
    </FormEditorStoreProvider>
  );
}

/**
 * Mirrors "a drag is in flight" onto the shell root as `data-drag-active`, so
 * placement-mode styling (receded selection accents, folded action bars,
 * dimmed empty-zone hints) is pure CSS. This is the only subscriber that
 * re-renders on drag start / end — every canvas block reads the flag through
 * `[data-drag-active]` descendant selectors instead of its own subscription.
 */
function DragPlacementFlag({ shellRef }: { shellRef: RefObject<HTMLDivElement | null> }): null {
  const dragActive = !isNullish(useDragOperation().source);

  useEffect(() => {
    const shell = shellRef.current;

    if (!shell || !dragActive) {
      return;
    }

    shell.dataset.dragActive = "";

    return () => {
      delete shell.dataset.dragActive;
    };
  }, [dragActive, shellRef]);

  return null;
}

export interface FormEditorShellProps {
  children: ReactNode;
}

/**
 * The editor's chrome frame: layout measurement (`data-layout` adaptivity),
 * device context, the shared drag-drop context, and the shell-scoped keyboard
 * shortcuts. Render the editor surfaces (toolbar / workspace parts) as
 * children — {@link FormEditor} shows the canonical arrangement.
 */
export function FormEditorShell({ children }: FormEditorShellProps): ReactElement {
  const device = useFormEditorStore(s => s.device);
  const { mode, ref } = useEditorLayoutMeasure();
  const handleDragEnd = useEditorDragEnd();

  // Shares the layout-measure ref: shortcuts listen on the same shell root the
  // layout mode is measured from, so keystrokes outside this editor instance
  // (or in another mounted editor) never reach them.
  useEditorShortcuts(ref);

  return (
    <EditorLayoutProvider value={mode}>
      <DeviceProvider device={device}>
        <DragDropProvider sensors={editorSensors} onDragEnd={handleDragEnd}>
          <DragPlacementFlag shellRef={ref} />

          <div ref={ref} css={rootCss} data-layout={mode} tabIndex={-1}>
            {children}
          </div>
        </DragDropProvider>
      </DeviceProvider>
    </EditorLayoutProvider>
  );
}

/**
 * The horizontal band under the toolbar: palette | stage | properties. Also
 * the positioning anchor for the narrow-layout properties overlay.
 */
export function FormEditorWorkspace({ children }: { children: ReactNode }): ReactElement {
  return <div css={workspaceCss}>{children}</div>;
}

/**
 * The canvas column: design surface, the form-config drawer floating over its
 * bottom edge, and the status footer (edit mode only).
 */
export function FormEditorStage(): ReactElement {
  const isEditing = useFormEditorStore(s => s.viewMode === "edit");

  return (
    <div css={stageCss}>
      <div css={canvasAreaCss}>
        <Canvas />
        <FormConfigDrawer />
      </div>

      {isEditing ? <EditorFooter /> : null}
    </div>
  );
}

export interface FormEditorProps extends Omit<FormEditorProviderProps, "children"> {
  /**
   * Brand label/tag shown at the toolbar's left edge. Override so a downstream
   * app does not ship the framework's own name.
   */
  brand?: ToolbarBrand;
  /**
   * Invoked with the current schema when the user confirms the "发布" action.
   * The editor runs a validation pass first — errors block publishing and
   * warnings ask the designer for confirmation. Publishing itself is host
   * semantics (upload / persistence), so when this is omitted the publish
   * button is not rendered at all.
   */
  onPublish?: (schema: FormSchema) => void;
}

/**
 * The pre-composed visual form editor: provider + shell + the canonical
 * toolbar / palette / stage / properties arrangement. Hosts that need a
 * different shell (own toolbar, relocated panels) compose the same parts
 * directly:
 *
 * ```tsx
 * <FormEditor.Provider initialSchema={schema} apiRef={api}>
 * <FormEditor.Shell>
 * <MyToolbar />
 * <FormEditor.Workspace>
 * <FormEditor.Palette />
 * <FormEditor.Stage />
 * <FormEditor.Properties />
 * </FormEditor.Workspace>
 * </FormEditor.Shell>
 * </FormEditor.Provider>
 * ```
 */
function FormEditorRoot({
  brand,
  onPublish,
  ...providerProps
}: FormEditorProps): ReactElement {
  return (
    <FormEditorProvider {...providerProps}>
      <FormEditorShell>
        <Toolbar brand={brand} onPublish={onPublish} />

        <FormEditorWorkspace>
          <PalettePanel />
          <FormEditorStage />
          <PropertiesPanel />
        </FormEditorWorkspace>
      </FormEditorShell>
    </FormEditorProvider>
  );
}

export const FormEditor = Object.assign(FormEditorRoot, {
  Provider: FormEditorProvider,
  Shell: FormEditorShell,
  Workspace: FormEditorWorkspace,
  Stage: FormEditorStage,
  Toolbar,
  Palette: PalettePanel,
  Properties: PropertiesPanel
});
