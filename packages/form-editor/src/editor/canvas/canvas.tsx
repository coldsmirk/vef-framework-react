import type { CSSProperties, ReactElement, ReactNode } from "react";

import type { EditorViewMode } from "../../store/form-store";
import type { Block, ChromeTabItem, FlexNode, FormField, FormSchema, GapScale, GridNode, PresentationDevice, SectionNode, SubformNode, TabsNode } from "../../types";
import type { DropZoneData } from "../dnd";
import type { PreviewRuntime } from "../preview-runtime-context";
import type { DropZoneDescriptor } from "./drop-zones";

import { css } from "@emotion/react";
import { Flex, globalCssVars, Stack } from "@vef-framework-react/components";
import { CollisionPriority, useDroppable } from "@vef-framework-react/core";
import { Activity, createContext, lazy, memo, Suspense, use, useMemo, useState } from "react";

import { MobileScope } from "../../components/mobile/scope";
import { assertNever } from "../../engine/assert-never";
import { resolvePresentation } from "../../engine/schema/presentation";
import { isContainerNode } from "../../engine/schema/walk";
import { EditorIcon } from "../../icons";
import { DataSourceProvider } from "../../render/data-source-context";
import { FLEX_ALIGN_MAP, FLEX_JUSTIFY_MAP, flexSlotStyle } from "../../render/flex-style";
import { FormFieldRenderer } from "../../render/form-field";
import { FormRenderer } from "../../render/form-renderer";
import { gridCellStyle, gridColumnCount, gridContainerStyle } from "../../render/grid-style";
import { DEFAULT_STACK_GAP, resolveStackGap } from "../../render/stack-style";
import { useContainerChrome } from "../../store/engine-provider";
import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { dropZoneId, fallbackDropZoneId, FIELD_DRAG_TYPE } from "../dnd";
import { usePreviewRuntime } from "../preview-runtime-context";
import { CanvasField, SubtreeDraggingContext } from "./canvas-field";
import { DropIndicator } from "./drop-indicator";
import { inlineSlots, stackGapDescriptor } from "./drop-zones";
import { MobileSeedState } from "./mobile-seed-state";
import { PhoneFrame, phoneViewportCss } from "./phone-frame";

// The JSON workbench drags the whole CodeMirror stack (~1MB unminified) in
// with it; the split keeps that out of the editor's first paint — the chunk
// loads the first time the designer opens the JSON view.
const JsonSplitView = lazy(async () => {
  const module = await import("./json-split-view");

  return { default: module.JsonSplitView };
});

const surfaceLoadingCss = css({
  display: "flex",
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  minHeight: 160,
  color: globalCssVars.colorTextTertiary,
  fontSize: globalCssVars.fontSizeSm
});

function SurfaceLoading(): ReactElement {
  return <div css={surfaceLoadingCss}>正在加载编辑器…</div>;
}

/**
 * The active document's form-level stack gap in pixels, provided by
 * {@link EditDocument}. Container previews read it as the gap their body inherits
 * when it sets no `gap` of its own, and flex / grid previews as their default
 * gap — mirroring how the runtime threads the same value through `ctx.gutter`.
 */
const FormGapContext = createContext<number>(DEFAULT_STACK_GAP);

// The root document's append target is a constant — a single shared instance so
// the root StackBody's `useDroppable` registration never churns its `data` (the
// default `Object.is` compare) or recomputes its fallback id across renders.
const ROOT_TAIL_TARGET: DropZoneData = { zone: "root" };

const canvasCss = css({
  position: "relative",
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "auto",
  padding: `${globalCssVars.spacingXl} ${globalCssVars.spacingXxl}`,
  background: globalCssVars.colorBgLayout
});

const surfaceCss = css({
  position: "relative",
  // Fill the canvas: grow to the viewport height, never shrink below content
  // (so an overflowing form scrolls the canvas instead of being squashed).
  flex: "1 0 auto",
  // A column so the empty-state drop zone can grow to fill the whole sheet.
  display: "flex",
  flexDirection: "column",
  width: "100%",
  // Auto cross-axis margins center the surface only when it is narrower than
  // the canvas — i.e. in mobile mode, where `maxWidth` caps it at 414.
  margin: "0 auto",
  padding: globalCssVars.spacingXl,
  borderRadius: globalCssVars.borderRadiusLg,
  background: globalCssVars.colorBgContainer,
  // The sheet is the only elevated plane in the workspace (the side docks are
  // flat hairline columns), so its neutral, theme-correct shadow reads as the
  // focal document.
  boxShadow: globalCssVars.shadowSm
});

const bodyFillCss = css({
  // Root document only: grow so the blank area below the last row is part of
  // this body's fallback droppable — a drop anywhere down there appends to the
  // form. The grow is a no-op inside a container body (which sizes to content).
  flex: "1 0 auto"
});

const bodyAppendActiveCss = css({
  // The body-level fallback is the active drop target — the pointer missed every
  // precise zone (it is over a block's centre or the blank area). Signal "append
  // to the end of this region" with a faint wash plus an insertion bar drawn
  // right after the last row.
  background: `color-mix(in srgb, ${globalCssVars.colorPrimary} 4%, transparent)`,
  borderRadius: globalCssVars.borderRadius,

  "&::after": {
    content: "\"\"",
    display: "block",
    height: 3,
    margin: "6px 2px 1px",
    borderRadius: 2,
    background: globalCssVars.colorPrimary,
    boxShadow: `0 0 6px color-mix(in srgb, ${globalCssVars.colorPrimary} 45%, transparent)`
  }
});

// Hit area for a stack-gap zone: a band straddling a stacked block's top edge,
// so it sits in the Stack's flex gap above the block. Absolute (zero layout
// footprint) so the gap the user sees is exactly the Stack `gap`, not gap +
// zone. The visible mark is the centred {@link DropIndicator}.
const gapHitCss = css({
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  height: 14,
  transform: "translateY(-50%)",
  zIndex: 1,
  pointerEvents: "none"
});

// A slot (inline or stacked) positions its zones against its own edges.
const slotCss = css({
  position: "relative"
});

// Hit area for a beside zone: a narrow band straddling a slot's left/right edge.
const besideHitCss = css({
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 14,
  zIndex: 1,
  pointerEvents: "none"
});

const besideLeftCss = css({ left: -7 });
const besideRightCss = css({ right: -7 });

const emptyZoneCss = css({
  display: "flex",
  // Fill the surface when the form is empty so the whole sheet is droppable.
  // The grow is a no-op inside a block container body (section/tabs/subform),
  // where minHeight keeps the familiar compact zone.
  flex: 1,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: globalCssVars.spacingXs,
  minHeight: 160,
  padding: globalCssVars.spacingXl,
  border: `1px dashed ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  color: globalCssVars.colorTextTertiary,
  fontSize: globalCssVars.fontSize,
  textAlign: "center",
  transition: [
    `border-color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  ].join(", "),

  // Direct child only: this sizes the zone's own headline glyph. A descendant
  // `& svg` would also capture any icon nested deeper (e.g. inside a button).
  "& > svg": { width: 22, height: 22 },

  "& > svg, & > span": {
    transition: `opacity ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  },

  // Placement mode: the drag ghost follows the pointer right over this zone, so
  // the hint copy underneath would jumble with the ghost's label. Recede it —
  // the tinted border/wash from `emptyActiveCss` already says "drop here".
  "[data-drag-active] & > svg, [data-drag-active] & > span": {
    opacity: 0.4
  }
});

const emptyActiveCss = css({
  // A calm "drop here" cue: tint only the border to the accent plus a faint
  // wash — matching the restrained gap / append affordances — instead of
  // flooding the whole zone with a solid primary fill.
  borderColor: globalCssVars.colorPrimary,
  background: `color-mix(in srgb, ${globalCssVars.colorPrimary} 6%, transparent)`,
  color: globalCssVars.colorTextSecondary
});

// Zero-footprint container boundary: a faint dashed outline so the flex
// region reads as a distinct layout area, with no padding or min-height — the
// flex body occupies exactly the box the runtime `FlexFlow` would, keeping
// design mode pixel-faithful to the preview. The outline hugs the true box;
// the block wrapper's own chrome floats 2px outside it, so the two stay
// visually layered. Drop comfort for an EMPTY flex is EmptyZone's job (an
// empty container renders nothing at runtime, so there is no layout to stay
// faithful to).
const flexPreviewCss = css({
  borderRadius: globalCssVars.borderRadius,
  outline: `1px dashed ${globalCssVars.colorBorderSecondary}`,
  outlineOffset: 0
});

const flexAppendActiveCss = css({
  outlineColor: globalCssVars.colorPrimary,
  background: `color-mix(in srgb, ${globalCssVars.colorPrimary} 4%, transparent)`
});

// Zero-footprint container boundary, same contract as `flexPreviewCss`.
// `display: grid` and the track template come from `gridContainerStyle`.
const gridPreviewCss = css({
  borderRadius: globalCssVars.borderRadius,
  outline: `1px dashed ${globalCssVars.colorBorderSecondary}`,
  outlineOffset: 0
});

/**
 * The design canvas. In edit mode it renders the schema tree as a vertical stack
 * of blocks, each wrapped in a {@link CanvasField}, interleaved with drop zones
 * (between blocks, beside blocks, and inside containers). In preview mode it
 * renders the live {@link FormRenderer}.
 *
 * The `DragDropProvider` lives in the editor shell so palette items and canvas
 * zones share one drag context.
 */
export function Canvas(): ReactElement {
  const schema = useFormEditorStore(s => s.schema);
  const viewMode = useFormEditorStore(s => s.viewMode);
  const device = useFormEditorStore(s => s.device);
  const storeApi = useFormEditorStoreApi();
  const previewRuntime = usePreviewRuntime();

  // Clicking the blank surface only clears the current selection (closing the
  // control-property panel with it). Form-level config lives in the bottom
  // drawer now, so a blank click no longer toggles any panel.
  const handleSurfaceClick = (): void => {
    storeApi.getState().selectNode(null);
  };

  // The phone shell wraps the mobile design / preview surface. JSON view is a
  // side-by-side editor that needs the full width, so it stays on the plain
  // sheet even on mobile.
  const inPhoneFrame = device === "mobile" && viewMode !== "json";

  const surface = (
    <div
      css={inPhoneFrame ? phoneViewportCss : surfaceCss}
      data-device={device}
      data-testid="canvas-surface"
      onClick={handleSurfaceClick}
    >
      {renderSurface(viewMode, schema, device, previewRuntime)}
    </div>
  );

  return (
    <div css={canvasCss}>
      {inPhoneFrame ? <PhoneFrame>{surface}</PhoneFrame> : surface}
    </div>
  );
}

/**
 * Resolve the canvas body for the active view mode: the editable document tree
 * (`edit`), the live form (`preview`), or the JSON / render split (`json`).
 *
 * The edit document is kept alive inside an {@link Activity} while previewing
 * or inspecting JSON: at hundreds of blocks a full unmount/remount per round
 * trip (every draggable re-registered, every cell re-rendered) is a visible
 * stall, while a hidden tree costs nothing. The preview itself stays
 * fresh-mounted — its form state intentionally resets per visit.
 */
function renderSurface(viewMode: EditorViewMode, schema: FormSchema, device: PresentationDevice, runtime: PreviewRuntime): ReactElement {
  // Only the edit document needs the canvas-owned DataSourceProvider: its field
  // previews resolve their options without a FormRenderer, so a Select opened
  // live on the canvas shows real data-source options. Preview and JSON modes
  // render through FormRenderer, which mounts its own provider with the real
  // resolver + versions, so wrapping them here is dead weight.
  const editDocument = (
    <DataSourceProvider dataSources={schema.dataSources}>
      <EditDocument device={device} schema={schema} />
    </DataSourceProvider>
  );

  return (
    <>
      <Activity mode={viewMode === "edit" ? "visible" : "hidden"}>
        {/* The mobile design tree renders antd-mobile controls, so it needs the
            theme bridge / locale from MobileScope. Overlay containment stays off
            (the default): a tapped picker opens uncontained (a body-portaled
            full-screen sheet) and the user dismisses it to resume dragging — a
            normal modal flow. Penning it into the phone would need a promoting
            transform that re-bases the drag ghost's fixed coordinates, so edit
            mode skips it; only the preview surface (no dragging) contains overlays. */}
        {device === "mobile" ? <MobileScope>{editDocument}</MobileScope> : editDocument}
      </Activity>

      {viewMode === "preview"
        ? (
            // No `containOverlays`: in the phone frame the overlay container is
            // supplied externally (the shell's screen) so masks cover the whole
            // screen; a bare mobile preview elsewhere keeps native behavior.
            <FormRenderer
              dataSourceResolver={runtime.dataSourceResolver}
              device={device}
              evaluators={runtime.evaluators}
              expressionContext={runtime.expressionContext}
              schema={schema}
            />
          )
        : null}

      {viewMode === "json"
        ? (
            <Suspense fallback={<SurfaceLoading />}>
              <JsonSplitView device={device} runtime={runtime} schema={schema} />
            </Suspense>
          )
        : null}
    </>
  );
}

/**
 * The editable design document for the active device. An undesigned device (only
 * mobile can reach this) shows the seed state; otherwise the device's own block
 * tree renders through {@link StackBody}.
 */
function EditDocument({ device, schema }: { device: PresentationDevice; schema: FormSchema }): ReactElement {
  const layer = resolvePresentation(schema, device);
  // Memoized so the provider value is a stable primitive (a fresh resolve each
  // render would, per the context-value lint rule, look like a new construction).
  const formGap = useMemo(() => resolveStackGap(layer?.gap, DEFAULT_STACK_GAP), [layer?.gap]);

  if (layer === undefined) {
    return <MobileSeedState />;
  }

  return (
    <FormGapContext value={formGap}>
      <StackBody fill blocks={layer.children} tailTarget={ROOT_TAIL_TARGET} />
    </FormGapContext>
  );
}

/**
 * One precise drop zone: a single `useDroppable` plus a single
 * {@link DropIndicator}, positioned by its descriptor's orientation (a row gap
 * in the document flow, or a beside band straddling a slot edge). All canvas
 * insertion points render through this one component, so they share one
 * collision contract and one visual mark.
 */
function Zone({ descriptor }: { descriptor: DropZoneDescriptor }): ReactElement {
  const { isDropTarget, ref } = useDroppable({
    id: descriptor.id,
    type: FIELD_DRAG_TYPE,
    accept: FIELD_DRAG_TYPE,
    collisionPriority: descriptor.priority,
    data: descriptor.data
  });

  const side = descriptor.data.zone === "beside" ? descriptor.data.side : undefined;

  return (
    <div
      ref={ref}
      data-testid="drop-zone"
      css={[
        descriptor.orientation === "vertical" ? besideHitCss : gapHitCss,
        descriptor.orientation === "vertical" && side === "before" && besideLeftCss,
        descriptor.orientation === "vertical" && side === "after" && besideRightCss
      ]}
    >
      <DropIndicator isActive={isDropTarget} orientation={descriptor.orientation} />
    </div>
  );
}

/**
 * The empty-state drop target for a body with no rows/slots. Its droppable
 * carries the body's append target so a drop lands at the start of the region.
 */
function EmptyZone({ disabled, tailTarget }: { disabled: boolean; tailTarget: DropZoneData }): ReactElement {
  const { isDropTarget, ref } = useDroppable({
    id: dropZoneId(tailTarget),
    type: FIELD_DRAG_TYPE,
    accept: FIELD_DRAG_TYPE,
    collisionPriority: CollisionPriority.Low,
    disabled,
    data: tailTarget
  });

  return (
    <div ref={ref} css={[emptyZoneCss, isDropTarget && emptyActiveCss]}>
      <EditorIcon name="mouse-pointer-2" />
      <span>从左侧拖入组件，或双击组件追加到此处</span>
    </div>
  );
}

interface StackBodyProps {
  blocks: Block[];
  /**
   * Drop data for the body's append target — used by both the empty-state zone
   * and the body-level fallback. Appends to this body (root or container).
   */
  tailTarget: DropZoneData;
  /**
   * Grow to fill the available height. Set on the root document so the blank
   * area below the last block joins the fallback droppable; left off for
   * container bodies, which size to their content.
   */
  fill?: boolean;
  /**
   * This body's own vertical gap. Omitted (the root document) means inherit the
   * form-level gap from {@link FormGapContext}.
   */
  gap?: GapScale;
}

/**
 * A vertical container body (root document, section, tabs, subform): a stack-gap
 * {@link Zone} before each block, and a body-level fallback that appends on a
 * drop that misses every precise zone. While an ancestor block is being dragged
 * ({@link SubtreeDraggingContext}), this body is inside the drag ghost, so it
 * renders no zones and disables its fallback — nothing inside the dragged subtree
 * is a valid target.
 */
function StackBody({
  blocks,
  fill = false,
  gap,
  tailTarget
}: StackBodyProps): ReactElement {
  const formGap = use(FormGapContext);
  const suppressed = use(SubtreeDraggingContext);
  const { isDropTarget, ref } = useDroppable({
    id: fallbackDropZoneId(tailTarget),
    type: FIELD_DRAG_TYPE,
    accept: FIELD_DRAG_TYPE,
    collisionPriority: CollisionPriority.Lowest,
    disabled: suppressed,
    data: tailTarget
  });

  if (blocks.length === 0) {
    return <EmptyZone disabled={suppressed} tailTarget={tailTarget} />;
  }

  // This body's own gap, else the inherited form-level gap — the same resolution
  // the runtime applies through `ctx.gutter`.
  const gapPx = resolveStackGap(gap, formGap);

  return (
    <Stack ref={ref} css={[fill && bodyFillCss, isDropTarget && bodyAppendActiveCss]} gap={gapPx}>
      {blocks.map(block => <StackSlot key={block.id} block={block} />)}
    </Stack>
  );
}

// Deliberately NO `content-visibility` here: it implies paint containment,
// which clips every descendant painting outside the slot's box — and the
// block's floating action bar hangs above the wrapper (`bottom: 100%`), i.e.
// exactly outside this box. The offscreen-skip optimization lives on the leaf
// preview shield instead (see canvas-field.tsx), where the actual render
// weight is and where nothing escapes the contained box.
const stackSlotCss = css({
  position: "relative"
});

interface StackSlotProps {
  block: Block;
}

/**
 * One stacked slot: the gap drop zone above the block plus the block itself.
 * Memoized by block reference so a property keystroke re-renders only the
 * edited block's slot — every other slot (zone wrapper included) bails, which
 * matters at hundreds of blocks.
 */
const StackSlot = memo(({ block }: StackSlotProps): ReactElement => {
  const suppressed = use(SubtreeDraggingContext);

  return (
    <div css={stackSlotCss}>
      {suppressed ? null : <Zone descriptor={stackGapDescriptor(block.id)} />}
      <EditorBlock block={block} />
    </div>
  );
});

StackSlot.displayName = "StackSlot";

interface InlineBody {
  ref: (element: Element | null) => void;
  isDropTarget: boolean;
  isEmpty: boolean;
  suppressed: boolean;
  slots: ReactNode;
}

/**
 * Shared wiring for an inline container body (flex / grid): the body-level
 * append fallback plus the flattened slots, each carrying its beside
 * {@link Zone}s (the N+1 dedup is owned by {@link inlineSlots}). The container
 * chrome differs per type, so the caller renders its own element and attaches
 * `ref` / `isDropTarget`. Zones are children of the slot wrapper (siblings of the
 * draggable {@link CanvasField}), so they never travel with a dragged slot; when
 * an ancestor is dragging they are dropped entirely.
 */
function useInlineBody(
  blocks: Block[],
  tailTarget: DropZoneData,
  slotStyle: (block: Block) => CSSProperties
): InlineBody {
  const suppressed = use(SubtreeDraggingContext);
  const { isDropTarget, ref } = useDroppable({
    id: fallbackDropZoneId(tailTarget),
    type: FIELD_DRAG_TYPE,
    accept: FIELD_DRAG_TYPE,
    collisionPriority: CollisionPriority.Lowest,
    disabled: suppressed,
    data: tailTarget
  });

  // EditorBlock (memo by block reference) is the cell body, mirroring the
  // runtime side's per-cell memo: a property keystroke inside a grid/flex
  // re-renders only the edited cell, not every sibling.
  const slots = inlineSlots(blocks).map(slot => (
    <div key={slot.block.id} css={slotCss} style={slotStyle(slot.block)}>
      <EditorBlock block={slot.block} />
      {suppressed ? null : slot.beside.map(zone => <Zone key={zone.id} descriptor={zone} />)}
    </div>
  ));

  return {
    ref,
    isDropTarget,
    isEmpty: blocks.length === 0,
    suppressed,
    slots
  };
}

function EditorBlockBase({ block }: { block: Block }): ReactElement {
  return (
    <CanvasField block={block}>
      <BlockContent block={block} />
    </CanvasField>
  );
}

// Memoized by block reference: mutate.ts shares structure so an unchanged block
// keeps its identity across edits, letting a single property keystroke re-render
// only the edited branch instead of every block on the canvas.
const EditorBlock = memo(EditorBlockBase);

/**
 * A leaf field preview on the edit canvas. Holds a THROWAWAY local value so the
 * preview actually responds: typing into an input or picking a Select option
 * reflects on the canvas, and a data-bound Select opened here shows its real
 * options. The value never touches the schema and resets when a device /
 * view-mode switch remounts the tree — design previews must not mutate form data.
 * Editor shortcuts already bail while a control is focused, so live inputs never
 * trigger delete/undo (see use-editor-shortcuts).
 */
function LeafFieldPreview({ block }: { block: FormField }): ReactElement {
  const [value, setValue] = useState<unknown>();

  // Canvas-scoped dom id: the kept-alive edit document coexists with the
  // preview's FormRenderer in the DOM, and the runtime owns `field-<id>` —
  // sharing it would duplicate ids and break the preview's label wiring.
  return (
    <FormFieldRenderer
      domId={`canvas-field-${block.id}`}
      field={block}
      value={value}
      onChange={setValue}
    />
  );
}

function BlockContent({ block }: { block: Block }): ReactElement {
  // Narrowing first (instead of routing leaves through the switch `default`)
  // makes the container switch compile-forced complete: a sixth container
  // variant fails the `assertNever` below rather than silently rendering as a
  // leaf field with no registered renderer.
  if (!isContainerNode(block)) {
    return <LeafFieldPreview block={block} />;
  }

  switch (block.type) {
    case "section": {
      return <SectionPreview section={block} />;
    }

    case "tabs": {
      return <TabsPreview tabs={block} />;
    }

    case "subform": {
      return <SubformPreview subform={block} />;
    }

    case "flex": {
      return <FlexPreview flex={block} />;
    }

    case "grid": {
      return <GridPreview grid={block} />;
    }

    default: {
      return assertNever(block);
    }
  }
}

function SectionPreview({ section }: { section: SectionNode }): ReactElement {
  const chrome = useContainerChrome();
  const fallbackTitle = section.variant === "collapse" ? "折叠面板" : "卡片";
  const defaultCollapsed = section.variant === "collapse" ? section.defaultCollapsed : undefined;
  const tailTarget = useMemo<DropZoneData>(() => {
    return { zone: "container", containerId: section.id };
  }, [section.id]);

  return (
    <chrome.Section defaultCollapsed={defaultCollapsed} title={section.title ?? fallbackTitle} variant={section.variant}>
      <StackBody blocks={section.children} gap={section.gap} tailTarget={tailTarget} />
    </chrome.Section>
  );
}

function TabsPreview({ tabs }: { tabs: TabsNode }): ReactElement {
  const chrome = useContainerChrome();
  // Memoized on the tabs node: each tab body's append target carries the tab
  // index, so the list is rebuilt only when the tabs node itself changes
  // (structural sharing keeps it stable across unrelated edits) rather than
  // minting fresh `tailTarget` literals — and their droppable data — every render.
  const items: ChromeTabItem[] = useMemo(
    () => tabs.tabs.map((tab, index) => {
      return {
        children: (
          <StackBody
            blocks={tab.children}
            gap={tabs.gap}
            tailTarget={{
              zone: "container",
              containerId: tabs.id,
              tabIndex: index
            }}
          />
        ),
        key: tab.id,
        label: tab.label
      };
    }),
    [tabs]
  );

  return <chrome.Tabs items={items} />;
}

function SubformPreview({ subform }: { subform: SubformNode }): ReactElement {
  const chrome = useContainerChrome();
  const tailTarget = useMemo<DropZoneData>(() => {
    return { zone: "container", containerId: subform.id };
  }, [subform.id]);

  return (
    <chrome.Subform title={subform.label ?? "子表单"}>
      <StackBody blocks={subform.template} gap={subform.variant === "stack" ? subform.gap : undefined} tailTarget={tailTarget} />
    </chrome.Subform>
  );
}

/**
 * Flex container preview. Lays its slots inline via the components `<Flex>`, each
 * slot a {@link CanvasField} flanked by beside {@link Zone}s. The container's
 * row-list is flattened to its blocks (each "row" is one slot); the inline body
 * wiring (fallback + slots + zones + drag suppression) is shared via
 * {@link useInlineBody}.
 */
function FlexPreview({ flex }: { flex: FlexNode }): ReactElement {
  const formGap = use(FormGapContext);
  const blocks = flex.children;
  const tailTarget = useMemo<DropZoneData>(() => {
    return { zone: "container", containerId: flex.id };
  }, [flex.id]);
  const body = useInlineBody(blocks, tailTarget, block => flexSlotStyle(block.flex));

  if (body.isEmpty) {
    return <EmptyZone disabled={body.suppressed} tailTarget={tailTarget} />;
  }

  return (
    <Flex
      ref={body.ref}
      align={FLEX_ALIGN_MAP[flex.align ?? "start"]}
      css={[flexPreviewCss, body.isDropTarget && flexAppendActiveCss]}
      gap={flex.gap ?? formGap}
      justify={FLEX_JUSTIFY_MAP[flex.justify ?? "start"]}
      vertical={flex.direction === "column"}
      wrap={flex.wrap ? "wrap" : "nowrap"}
    >
      {body.slots}
    </Flex>
  );
}

/**
 * Grid container preview. Lays its cells across a fixed number of equal columns
 * via real CSS grid, each cell a {@link CanvasField} flanked by beside
 * {@link Zone}s. The container's row-list is flattened to its blocks (each "row"
 * is one cell); the inline body wiring is shared via {@link useInlineBody}.
 */
function GridPreview({ grid }: { grid: GridNode }): ReactElement {
  const formGap = use(FormGapContext);
  const blocks = grid.children;
  const columns = gridColumnCount(grid);
  const tailTarget = useMemo<DropZoneData>(() => {
    return { zone: "container", containerId: grid.id };
  }, [grid.id]);
  const body = useInlineBody(blocks, tailTarget, block => gridCellStyle(block.span, columns));

  if (body.isEmpty) {
    return <EmptyZone disabled={body.suppressed} tailTarget={tailTarget} />;
  }

  return (
    <div
      ref={body.ref}
      css={[gridPreviewCss, body.isDropTarget && flexAppendActiveCss]}
      style={gridContainerStyle(grid, formGap)}
    >
      {body.slots}
    </div>
  );
}
