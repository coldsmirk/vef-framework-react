import type { EdgeMouseHandler, NodeMouseHandler } from "@xyflow/react";
import type { CSSProperties, FC, RefObject } from "react";

import type { EditorPlugins } from "../plugins";
import type { FlowDefinition, FormFieldDefinition } from "../types";

import { NodeloomProvider, useEditorStore, useEditorStoreApi, useReactFlowProps } from "@coldsmirk/nodeloom-core";
import { Global } from "@emotion/react";
import { Button, globalCssVars, showWarningMessage } from "@vef-framework-react/components";
import { Background, BackgroundVariant, MiniMap, Panel, ReactFlow, useStore, useUpdateNodeInternals } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { EDGE_MARKER_END, isNodeKind } from "../constants";
import { useDrop } from "../hooks/use-drag-drop";
import { useHistoryShortcuts } from "../hooks/use-history-shortcuts";
import { EditorPluginsContext, useEditorPlugins } from "../plugins";
import { validateFlowDefinition } from "../shared/flow-validation";
import { createSeedFlow } from "../shared/seed-flow";
import { fromFlowDefinition, toFlowDefinition } from "../shared/serialization";
import { buildEditorOptions, EditorUiProvider, engineNodeRegistry, useEditorUiStoreApi } from "../store";
import { canvasStyle, editorLayoutStyle, editorThemeStyle, NODE_KIND_COLORS, xyflowGlobalBaseStyle } from "../styles";
import { ConfigPanel } from "./config-panel";
import { edgeTypes } from "./edges";
import { EditorToolbar } from "./editor-toolbar";
import { renderApprovalNode } from "./nodes";
import { ZoomControl } from "./zoom-control";

export interface ApprovalFlowEditorProps {
  /**
   * Flow definition (backend format). Changing the reference after mount reloads
   * the canvas (e.g. the host finishes an async load or switches records).
   * Definitions emitted through `onChange` are recognized and never reload the
   * canvas, so the standard controlled round-trip
   * (`value={def} onChange={setDef}`) is safe. An empty or missing definition
   * seeds the canvas with a start and an end node.
   */
  value?: FlowDefinition;
  /**
   * Callback when flow changes. The emitted definition is a detached snapshot
   * (deep copy) — it never aliases editor state, so the host may retain,
   * mutate, or persist it freely. Passing the emitted object back as `value`
   * is recognized by reference and does not reload the canvas.
   */
  onChange?: (definition: FlowDefinition) => void;
  /**
   * Publish hook, invoked with the current definition after a validation pass.
   * Structural errors block publishing. When omitted, the publish button is not
   * rendered. Mirrors {@link FormEditor}'s `onPublish` so a host (e.g. a wizard
   * step) can wire both editors the same way.
   */
  onPublish?: (definition: FlowDefinition) => void;
  /**
   * Custom label for the publish button. Defaults to "发布". Relabel it — e.g.
   * "下一步" — when the editor's CTA doubles as a flow's forward action.
   */
  publishText?: string;
  /**
   * Shows a loading spinner on the publish button and blocks re-clicks while the
   * host processes the publish (e.g. an async create / deploy / publish chain).
   */
  publishLoading?: boolean;
  /**
   * Whether the editor is readonly
   */
  readonly?: boolean;
  /**
   * External plugins (user/role/department pickers)
   */
  plugins?: EditorPlugins;
  /**
   * Custom className
   */
  className?: string;
  /**
   * Custom style
   */
  style?: CSSProperties;
}

// Hoist stable object references to prevent ReactFlow from re-processing on every render
const EMPTY_PLUGINS: EditorPlugins = {};
// Stable fallback for EditorPlugins.formFields — a fresh [] default on every
// render would retrigger the validation effect below on every keystroke.
const EMPTY_FORM_FIELDS: FormFieldDefinition[] = [];
const DEFAULT_EDGE_OPTIONS = { type: "approval", markerEnd: EDGE_MARKER_END } as const;
const PRO_OPTIONS = { hideAttribution: true } as const;
const MINIMAP_STYLE = {
  width: 151,
  height: 100,
  marginBottom: 56
} as const;

// Tint minimap nodes with their kind accent (soft fill, solid stroke) so the
// overview reads the same color language as the canvas. The kind lives in
// `data.kind` (every node shares the single "flowNode" xyflow type); unknown
// kinds fall back to the neutral fill.
function minimapAccent(node: { data?: { kind?: unknown } }): string | undefined {
  const kind = node.data?.kind;

  return typeof kind === "string" && isNodeKind(kind) ? NODE_KIND_COLORS[kind] : undefined;
}

function minimapNodeColor(node: { data?: { kind?: unknown } }): string {
  const accent = minimapAccent(node);

  return accent ? `color-mix(in srgb, ${accent} 30%, transparent)` : globalCssVars.colorFill;
}

function minimapNodeStrokeColor(node: { data?: { kind?: unknown } }): string {
  return minimapAccent(node) ?? globalCssVars.colorFill;
}

// Validation runs debounced behind graph edits; long enough to coalesce a
// burst of typing, short enough to feel live.
const VALIDATION_DEBOUNCE_MS = 300;

const EditorInner: FC<ApprovalFlowEditorProps & { lastEmittedRef: RefObject<FlowDefinition | null> }> = ({
  value,
  onPublish,
  publishText,
  publishLoading = false,
  readonly = false,
  className,
  style,
  lastEmittedRef
}) => {
  const nodes = useEditorStore(s => s.nodes);
  const edges = useEditorStore(s => s.edges);
  const selectNode = useEditorStore(s => s.selectNode);
  const storeApi = useEditorStoreApi();
  const uiStoreApi = useEditorUiStoreApi();
  // The form's top-level field inventory, for cross-checking fieldPermissions
  // keys — same source the condition editor and field-permission table read.
  const { formFields = EMPTY_FORM_FIELDS } = useEditorPlugins();

  // The engine wires the canvas: graph, change dispatch, connection funnel (validation via
  // EditorOptions.validateConnection, rejected-drop reporting via onInvalidConnection), and the
  // single "flowNode" renderer dispatching on data.kind.
  const reactFlowProps = useReactFlowProps({
    nodeRegistry: engineNodeRegistry,
    renderNode: renderApprovalNode
  });

  const { onDragOver, onDrop } = useDrop();
  const updateNodeInternals = useUpdateNodeInternals();

  // Undo/redo keyboard shortcuts, scoped to this editor instance's shell.
  const shellRef = useRef<HTMLDivElement | null>(null);
  useHistoryShortcuts(shellRef);

  // Live deploy-contract validation: re-validate (debounced) whenever the
  // graph changes — including programmatic loads. Results land in the UI
  // store, where node chrome and the toolbar indicator subscribe to their own
  // slices.
  useEffect(() => {
    const timer = setTimeout(() => {
      uiStoreApi.getState().setValidationIssues(validateFlowDefinition(toFlowDefinition(nodes, edges), formFields));
    }, VALIDATION_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [nodes, edges, uiStoreApi, formFields]);

  // Re-measure every handle once ancestor transforms have settled. xyflow
  // measures node sizes through ResizeObserver (layout-based, immune to CSS
  // transforms) but handle bounds through getBoundingClientRect (NOT immune).
  // Mounting while an ancestor is mid-transform — e.g. the host page's
  // scale-in entrance animation — bakes the scale error into every handle's
  // bounds permanently: edges and new connections anchor visibly outside
  // their handles, while nodes added after the animation measure fine. There
  // is no "ancestor transforms settled" event, so poll the container's
  // rect-vs-layout width ratio (≠1 exactly while a scaling transform is
  // active) each frame and re-measure once it holds 1 for two consecutive
  // frames. The cap is wall-clock, not frames — a frame budget shrinks to
  // half on 120Hz displays — and bails out under a permanently transformed
  // ancestor (unsupported by xyflow regardless) instead of polling forever.
  //
  // Deliberately NO run-once ref guard: under StrictMode's double-invoked
  // effects the first run would claim the guard, its cleanup would cancel the
  // polling, and the second run would bail — leaving no watcher at all (the
  // previous one-shot re-measure died exactly this way). Re-running is
  // harmless: each run restarts the poll and converges on one re-measure.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const hasNodes = nodes.length > 0;
  const containerEl = useStore(s => s.domNode);

  useEffect(() => {
    if (!hasNodes || !containerEl) {
      return;
    }

    let raf = 0;
    let stableFrames = 0;
    const startedAt = performance.now();

    const tick = () => {
      const ratio = containerEl.offsetWidth === 0
        ? 0
        : containerEl.getBoundingClientRect().width / containerEl.offsetWidth;

      stableFrames = Math.abs(ratio - 1) < 0.001 ? stableFrames + 1 : 0;

      if (stableFrames >= 2 || performance.now() - startedAt > 4000) {
        updateNodeInternals(nodesRef.current.map(n => n.id));
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [hasNodes, containerEl, updateNodeInternals]);

  // Mirror the readonly prop into the UI store for chrome (node cards, panels,
  // edges subscribe reactively); the engine-level mutation gate rides
  // EditorOptions.readonly, resolved lazily from the same prop.
  useEffect(() => {
    uiStoreApi.getState().setReadonly(readonly);
  }, [readonly, uiStoreApi]);

  // Reload the canvas when `value` changes after mount (async load / record
  // switch). The initial value is already seeded into the store's initial
  // graph, so skip the first run. A definition this editor itself emitted
  // through onChange is skipped too — hosts that store the emitted definition
  // in state and pass it back (the standard controlled round-trip) must not
  // trigger a reload, which would wipe the selection and remount every node
  // mid-edit.
  const isInitialValueRef = useRef(true);

  useEffect(() => {
    if (isInitialValueRef.current) {
      isInitialValueRef.current = false;
      return;
    }

    if (value && value === lastEmittedRef.current) {
      return;
    }

    // An empty definition hydrates to the seed flow (start → end): start/end
    // are neither deletable nor addable, so the editor must guarantee them.
    // setGraph resets history (you cannot undo past a load).
    const graph = value && value.nodes.length > 0 ? fromFlowDefinition(value) : createSeedFlow();

    storeApi.getState().setGraph(graph);
    uiStoreApi.getState().setHoveredEdgeId(null);
  }, [value, storeApi, uiStoreApi, lastEmittedRef]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onEdgeMouseEnter: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      uiStoreApi.getState().setHoveredEdgeId(edge.id);
    },
    [uiStoreApi]
  );

  const onEdgeMouseLeave: EdgeMouseHandler = useCallback(() => {
    uiStoreApi.getState().setHoveredEdgeId(null);
  }, [uiStoreApi]);

  // Editor-native publish CTA: validate the current graph, block on structural
  // errors, otherwise hand the definition to the host. Mirrors FormEditor's
  // pre-publish gate so both editors behave the same inside a wizard step.
  const handlePublish = useCallback(() => {
    if (!onPublish) {
      return;
    }

    const document = storeApi.getState().getDocument();
    const definition = toFlowDefinition(document.nodes, document.edges);
    const issues = validateFlowDefinition(definition, formFields);

    if (issues.length > 0) {
      showWarningMessage(`流程校验未通过（${issues.length} 项），请先修正后再继续`);
      return;
    }

    onPublish(definition);
  }, [onPublish, storeApi, formFields]);

  return (
    // tabIndex makes the shell focusable, so the history shortcuts only fire
    // while focus is inside this editor instance.
    <div ref={shellRef} className={className} css={[editorThemeStyle, editorLayoutStyle]} style={style} tabIndex={-1}>
      <div css={canvasStyle}>
        <ReactFlow
          {...reactFlowProps}
          fitView
          panOnScroll
          connectionRadius={30}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          edgeTypes={edgeTypes}
          elementsSelectable={!readonly}
          nodesConnectable={!readonly}
          nodesDraggable={!readonly}
          proOptions={PRO_OPTIONS}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
        >
          <Background gap={16} size={1} variant={BackgroundVariant.Dots} />

          <MiniMap
            pannable
            zoomable
            nodeColor={minimapNodeColor}
            nodeStrokeColor={minimapNodeStrokeColor}
            nodeStrokeWidth={3}
            position="bottom-left"
            style={MINIMAP_STYLE}
          />

          <ZoomControl />

          {!readonly && onPublish
            ? (
                <Panel position="top-right">
                  <Button loading={publishLoading} type="primary" onClick={handlePublish}>
                    {publishText ?? "发布"}
                  </Button>
                </Panel>
              )
            : null}
        </ReactFlow>

        {!readonly && <EditorToolbar />}
      </div>

      {/* Floating config panel — always rendered for slide animation */}
      <ConfigPanel />
    </div>
  );
};

/**
 * Approval Flow Editor component
 */
export const ApprovalFlowEditor: FC<ApprovalFlowEditorProps> = ({
  value,
  onChange,
  onPublish,
  publishText,
  publishLoading,
  readonly,
  plugins,
  className,
  style
}) => {
  const [initialGraph] = useState(() => value && value.nodes.length > 0 ? fromFlowDefinition(value) : createSeedFlow());

  // The last definition handed to onChange — the reload effect recognizes it by
  // reference, so the controlled round-trip never remounts the canvas.
  const lastEmittedRef = useRef<FlowDefinition | null>(null);
  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  // Rebuilt per render (cheap plain object) and read lazily by the engine, so
  // prop flips — readonly above all — take effect without recreating the store.
  const editorOptions = buildEditorOptions({
    readonly: readonly ?? false,
    onDefinitionChange: definition => {
      lastEmittedRef.current = definition;
      onChangeRef.current?.(definition);
    },
    onConnectionRejected: showWarningMessage
  });

  return (
    <>
      <Global styles={xyflowGlobalBaseStyle} />

      {/* NodeloomProvider composes xyflow's ReactFlowProvider itself, so every
          canvas hook below resolves to the engine-owned instance. */}
      <EditorPluginsContext value={plugins ?? EMPTY_PLUGINS}>
        <NodeloomProvider
          defaultValue={initialGraph}
          nodeRegistry={engineNodeRegistry}
          options={editorOptions}
        >
          <EditorUiProvider initialState={{ readonly: readonly ?? false }}>
            <EditorInner
              className={className}
              lastEmittedRef={lastEmittedRef}
              publishLoading={publishLoading}
              publishText={publishText}
              readonly={readonly}
              style={style}
              value={value}
              onPublish={onPublish}
            />
          </EditorUiProvider>
        </NodeloomProvider>
      </EditorPluginsContext>
    </>
  );
};
