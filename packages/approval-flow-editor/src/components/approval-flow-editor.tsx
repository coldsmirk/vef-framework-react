import type { EdgeMouseHandler, NodeMouseHandler, OnConnectEnd } from "@xyflow/react";
import type { FC } from "react";

import type { EditorPlugins } from "../plugins";
import type { ConnectionRejection } from "../shared/connection-rules";
import type { FlowDefinition, NodeKind } from "../types";

import { Global } from "@emotion/react";
import { globalCssVars, showWarningMessage } from "@vef-framework-react/components";
import { Background, BackgroundVariant, MiniMap, ReactFlow, ReactFlowProvider, useStore, useUpdateNodeInternals } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { EDGE_MARKER_END, isNodeKind } from "../constants";
import { useConnectionValidation } from "../hooks/use-connection-validation";
import { useDrop } from "../hooks/use-drag-drop";
import { useHistoryShortcuts } from "../hooks/use-history-shortcuts";
import { EditorPluginsContext } from "../plugins";
import { explainConnectionRejection } from "../shared/connection-rules";
import { validateFlowDefinition } from "../shared/flow-validation";
import { createSeedFlow } from "../shared/seed-flow";
import { fromFlowDefinition, toFlowDefinition } from "../shared/serialization";
import { EditorStoreProvider, useEditorStore, useEditorStoreApi } from "../store";
import { canvasStyle, editorLayoutStyle, editorThemeStyle, NODE_KIND_COLORS, xyflowGlobalBaseStyle } from "../styles";
import { ConfigPanel } from "./config-panel";
import { edgeTypes } from "./edges";
import { EditorToolbar } from "./editor-toolbar";
import { nodeTypes } from "./nodes";
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
  style?: React.CSSProperties;
}

// Hoist stable object references to prevent ReactFlow from re-processing on every render
const EMPTY_PLUGINS: EditorPlugins = {};
const EMPTY_DEFINITION: FlowDefinition = { nodes: [], edges: [] };
const DEFAULT_EDGE_OPTIONS = { type: "approval", markerEnd: EDGE_MARKER_END } as const;
const PRO_OPTIONS = { hideAttribution: true } as const;
const MINIMAP_STYLE = {
  width: 151,
  height: 100,
  marginBottom: 56
} as const;

// Tint minimap nodes with their kind accent (soft fill, solid stroke) so the
// overview reads the same color language as the canvas. Falls back to the
// neutral fill for unknown kinds.
function minimapNodeColor(node: { type?: string }): string {
  return isNodeKind(node.type ?? "")
    ? `color-mix(in srgb, ${NODE_KIND_COLORS[node.type as NodeKind]} 30%, transparent)`
    : globalCssVars.colorFill;
}

function minimapNodeStrokeColor(node: { type?: string }): string {
  return isNodeKind(node.type ?? "") ? NODE_KIND_COLORS[node.type as NodeKind] : globalCssVars.colorFill;
}

// Human-readable hints for refused connection attempts — a silently dropped
// edge looks like a bug, not a rule.
const REJECTION_MESSAGES: Record<ConnectionRejection, string> = {
  self: "不能连接节点自身",
  occupied: "该出口已有连线，请先删除原有连线",
  cycle: "无法连接：会形成循环流转"
};

// Validation runs debounced behind graph edits; long enough to coalesce a
// burst of typing, short enough to feel live.
const VALIDATION_DEBOUNCE_MS = 300;

const EditorInner: FC<ApprovalFlowEditorProps> = ({
  value,
  onChange,
  readonly = false,
  className,
  style
}) => {
  const nodes = useEditorStore(s => s.nodes);
  const edges = useEditorStore(s => s.edges);
  const onNodesChange = useEditorStore(s => s.onNodesChange);
  const onEdgesChange = useEditorStore(s => s.onEdgesChange);
  const onConnect = useEditorStore(s => s.onConnect);
  const selectNode = useEditorStore(s => s.selectNode);
  const setHoveredEdgeId = useEditorStore(s => s.setHoveredEdgeId);
  const setReadonly = useEditorStore(s => s.setReadonly);
  const changeVersion = useEditorStore(s => s.changeVersion);
  const toDefinition = useEditorStore(s => s.toDefinition);
  const loadDefinition = useEditorStore(s => s.loadDefinition);
  const setValidationIssues = useEditorStore(s => s.setValidationIssues);
  const storeApi = useEditorStoreApi();

  const { onDragOver, onDrop } = useDrop();
  const { isValidConnection } = useConnectionValidation();
  const updateNodeInternals = useUpdateNodeInternals();

  // Undo/redo keyboard shortcuts, scoped to this editor instance's shell.
  const shellRef = useRef<HTMLDivElement | null>(null);
  useHistoryShortcuts(shellRef);

  // Live deploy-contract validation: re-validate (debounced) whenever the
  // graph changes — including programmatic loads, which never bump
  // changeVersion. Results land in the store, where node chrome and the
  // toolbar indicator subscribe to their own slices.
  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setValidationIssues(validateFlowDefinition(toFlowDefinition(nodes, edges)));
    }, VALIDATION_DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [nodes, edges, setValidationIssues]);

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

  useEffect(() => {
    setReadonly(readonly);
  }, [readonly, setReadonly]);

  // Reload the canvas when `value` changes after mount (async load / record
  // switch). The initial value is already seeded into the store's initialState,
  // so skip the first run. A definition this editor itself emitted through
  // onChange is skipped too — hosts that store the emitted definition in state
  // and pass it back (the standard controlled round-trip) must not trigger a
  // reload, which would wipe the selection and remount every node mid-edit.
  const isInitialValueRef = useRef(true);
  const lastEmittedRef = useRef<FlowDefinition | null>(null);

  useEffect(() => {
    if (isInitialValueRef.current) {
      isInitialValueRef.current = false;
      return;
    }

    if (value && value === lastEmittedRef.current) {
      return;
    }

    loadDefinition(value ?? EMPTY_DEFINITION);
  }, [value, loadDefinition]);

  // Notify parent of meaningful data changes via version counter.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const prevVersionRef = useRef(changeVersion);

  useEffect(() => {
    if (changeVersion === prevVersionRef.current) {
      return;
    }

    prevVersionRef.current = changeVersion;
    const definition = toDefinition();
    lastEmittedRef.current = definition;
    onChangeRef.current?.(definition);
  }, [changeVersion, toDefinition]);

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
      setHoveredEdgeId(edge.id);
    },
    [setHoveredEdgeId]
  );

  const onEdgeMouseLeave: EdgeMouseHandler = useCallback(() => {
    setHoveredEdgeId(null);
  }, [setHoveredEdgeId]);

  // A connection dropped on a real handle but refused by the rules gets an
  // explanation; releasing over empty canvas is a cancel and stays silent.
  const onConnectEnd: OnConnectEnd = useCallback(
    (_event, connectionState) => {
      if (connectionState.isValid !== false) {
        return;
      }

      const {
        fromNode,
        fromHandle,
        toNode,
        toHandle
      } = connectionState;

      if (!fromNode || !toNode) {
        return;
      }

      // xyflow allows starting a connection from either end; normalize to the
      // source → target orientation the rules are written for.
      const connection = fromHandle?.type === "target"
        ? {
            source: toNode.id,
            sourceHandle: toHandle?.id ?? null,
            target: fromNode.id
          }
        : {
            source: fromNode.id,
            sourceHandle: fromHandle?.id ?? null,
            target: toNode.id
          };
      const reason = explainConnectionRejection(connection, storeApi.getState().edges);

      if (reason) {
        showWarningMessage(REJECTION_MESSAGES[reason]);
      }
    },
    [storeApi]
  );

  return (
    // tabIndex makes the shell focusable, so the history shortcuts only fire
    // while focus is inside this editor instance.
    <div ref={shellRef} className={className} css={[editorThemeStyle, editorLayoutStyle]} style={style} tabIndex={-1}>
      <div css={canvasStyle}>
        <ReactFlow
          fitView
          panOnScroll
          connectionRadius={30}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          edges={edges}
          edgeTypes={edgeTypes}
          elementsSelectable={!readonly}
          isValidConnection={isValidConnection}
          nodes={nodes}
          nodesConnectable={!readonly}
          nodesDraggable={!readonly}
          nodeTypes={nodeTypes}
          proOptions={PRO_OPTIONS}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onEdgeMouseEnter={onEdgeMouseEnter}
          onEdgeMouseLeave={onEdgeMouseLeave}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodesChange={onNodesChange}
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
  readonly,
  plugins,
  className,
  style
}) => {
  const [initialData] = useState(() => value && value.nodes.length > 0 ? fromFlowDefinition(value) : createSeedFlow());

  return (
    <ReactFlowProvider>
      <Global styles={xyflowGlobalBaseStyle} />

      <EditorPluginsContext value={plugins ?? EMPTY_PLUGINS}>
        <EditorStoreProvider
          initialState={{
            readonly: readonly ?? false,
            nodes: initialData.nodes,
            edges: initialData.edges
          }}
        >
          <EditorInner
            className={className}
            readonly={readonly}
            style={style}
            value={value}
            onChange={onChange}
          />
        </EditorStoreProvider>
      </EditorPluginsContext>
    </ReactFlowProvider>
  );
};
