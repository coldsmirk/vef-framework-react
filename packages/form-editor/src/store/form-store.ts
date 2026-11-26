import type { ReturnedComponentStoreResult, UnboundStore } from "@vef-framework-react/core";

import type { DateGranularityField } from "../engine/schema/date-granularity";
import type { DropTarget } from "../engine/schema/edit-ops";
import type { DateGranularityScrubTarget } from "../engine/schema/reconcile";
import type { ScopePath } from "../engine/schema/walk";
import type { Block, DateGranularity, FieldCreateResult, FieldDefinition, FlexSlot, FormDataSource, FormField, FormSchema, FormVariable, GapScale, PresentationDevice, PresentationLayer, StackSlot } from "../types";

import { createComponentStore } from "@vef-framework-react/core";

import { createId, idPrefixForType } from "../engine/ids";
import { collectScopeKeys, collectSubtreeKeysByScope, generateUniqueKey, isKeyedNode, nextUniqueKey, sanitizeKey } from "../engine/keys";
import { hasNodeContractChange, syncNodeContractToTwin } from "../engine/schema/contract-sync";
import { isDateGranularityField, withFieldGranularity } from "../engine/schema/date-granularity";
import { cloneBlock, insertBlock, moveBlock, setColumnWidth as setColumnWidthOp, setFlex as setFlexOp, setSpan as setSpanOp, setStackSlot as setStackSlotOp, targetScope } from "../engine/schema/edit-ops";
import {
  editField as editFieldOp,
  removeBlock as removeNodeOp,
  updateNode as updateNodeOp
} from "../engine/schema/mutate";
import { createEmptySchema } from "../engine/schema/nodes";
import { currentLayer, resolvePresentation, withPresentation } from "../engine/schema/presentation";
import {
  hasLinkageDateLiterals,
  hasScopedDateLiterals,
  pruneDataSourceReferences,
  pruneFormRootKeyReferences,
  pruneScopedReferences,
  renameFormRootKeyReferences,
  renameKeyReferences,
  renameVariableReferences,
  scrubDateLiterals,
  scrubLinkageDateLiterals
} from "../engine/schema/reconcile";
import { removeTabBody } from "../engine/schema/removal-impact";
import { isValidVariableName } from "../engine/schema/validate";
import { countFields, findField, findKeyedNodeByKeyInScope, findNode, findScope, isLeafField, scopeEquals, walkNodes } from "../engine/schema/walk";

export type { DropTarget } from "../engine/schema/edit-ops";
export { createEmptySchema } from "../engine/schema/nodes";

/**
 * Maximum length of the undo timeline. Bounded so a long edit session does not
 * grow memory unboundedly; older entries are dropped from the front. Whole-
 * schema snapshots share structure with each other (the tree mutators rebuild
 * only the edited path), so each entry costs roughly one path, not one tree.
 */
const HISTORY_LIMIT = 100;

/**
 * Top-level view mode of the editor. `preview` and `json` both hide editor
 * chrome (selection outlines, palette/property panels): `preview` renders the
 * live form, `json` shows the schema JSON beside a live render.
 */
export type EditorViewMode = "edit" | "preview" | "json";

/**
 * Target device. Selects which presentation (field tree + layout) the editor
 * shows and edits, and drives the responsive width of the canvas surface.
 */
export type EditorDeviceMode = PresentationDevice;

/**
 * Tab of the left sidebar workbench. `palette` is the draggable component
 * catalog; `outline` is the active layer's node tree; `data` holds form-global
 * data sources and variables (form + host system variables).
 */
export type SidebarTabId = "palette" | "outline" | "data";

/**
 * Top-level tab of the right properties panel. `control` edits the currently
 * selected node (only active while a node is selected); `form` edits
 * form-level metadata, layout gap, and linkage (field overview + form events).
 */
export type PropertiesTabId = "control" | "form";

/**
 * The form-level metadata patched from the side panels. Shared fields (root
 * id, form-scope linkage, form-global variables / data sources) live on the
 * schema; `gap` is a layout default applied to the active device's presentation.
 */
export type FormSchemaPatch = Partial<Pick<FormSchema, "dataSources" | "id" | "linkage" | "variables">> & {
  gap?: GapScale;
};

/**
 * One form-global entry of the left sidebar's `数据` tab.
 */
export interface DataEntryRef {
  kind: "dataSource" | "variable";
  id: string;
}

/**
 * A linkage rule, and the step inside it when `actionIndex` is given.
 */
export interface LinkageFocusRef {
  /**
   * The node owning the rule; `null` for the form's own events.
   */
  nodeId: string | null;
  ruleIndex: number;
  actionIndex?: number;
}

export interface SaveDataEntryOptions {
  /**
   * Id of the entry a new one is placed right after; appended when omitted.
   */
  after?: string;
}

/**
 * One step of the global undo timeline: the **whole schema** as it was before
 * the edit, plus the device the edit happened on. Snapshotting the whole
 * schema (cheap, thanks to structural sharing) means every kind of edit —
 * structural, property, shared metadata (variables / data sources / linkage)
 * — reverts atomically and can never clobber state the edit did not touch.
 * `device` lets undo/redo jump the view to where the restored change happened.
 */
export interface HistoryEntry {
  schema: FormSchema;
  device: EditorDeviceMode;
}

/**
 * Options accepted by the property-editing actions ({@link FormEditorStoreState.editField} /
 * {@link FormEditorStoreState.updateBlock}).
 */
export interface EditCoalesceOptions {
  /**
   * Coalescing key for this edit run: consecutive edits sharing a key fold
   * into one undo step. Name what is being edited, finely enough that moving
   * to another property starts a fresh step (e.g. `field:<id>:<property>`).
   *
   * Omitting it means "this edit continues nothing" — the edit gets its own
   * undo step, and so does the next one. Folding is opt-in: a default derived
   * from the node would fold every discrete action on it into one step, which
   * is what made three add-tab clicks a single undo.
   */
  coalesceKey?: string;
}

export interface FormEditorStoreState {
  schema: FormSchema;
  /**
   * Currently selected node (field or container), or null for none. Selection
   * drives the right properties panel: selecting a node activates `control`,
   * clearing the selection switches back to `form`.
   */
  selectedId: string | null;
  /**
   * Active tab of the left sidebar (`palette` / `outline` / `data`). In narrow
   * (`drawer`) layout, any non-`palette` tab opens as a left-edge overlay, which
   * gives way to the right properties overlay while that is open.
   */
  sidebarTab: SidebarTabId;
  /**
   * Active top-level tab of the right properties panel (`control` / `form`).
   * Invariant: `"control"` is only active while `selectedId !== null`.
   */
  propertiesTab: PropertiesTabId;
  /**
   * Whether the narrow-layout (`drawer`) right properties overlay is open.
   * Ignored in docked mode, where the right panel stays permanently visible.
   */
  propertiesDrawerOpen: boolean;
  /**
   * One-shot request to open an entry's edit modal on the left `数据` tab,
   * cleared by the panel that handles it.
   */
  pendingDataEdit: DataEntryRef | null;
  /**
   * One-shot request to focus a linkage rule (and optional action step) in the
   * right properties panel, cleared by the rule list that handles it.
   */
  pendingLinkageFocus: LinkageFocusRef | null;
  viewMode: EditorViewMode;
  device: EditorDeviceMode;

  /**
   * Global undo timeline: the snapshot taken before each mutation, oldest
   * first, regardless of which device the edit happened on. Undo restores the
   * most recent change wherever it was made (jumping the view to its device);
   * view state (device / view mode / selection) is never checkpointed.
   */
  past: HistoryEntry[];
  /**
   * Snapshots re-poppable by `redo`. Cleared on every fresh edit.
   */
  future: HistoryEntry[];

  setSchema: (schema: FormSchema) => void;
  /**
   * Reset the document to an empty schema as an ordinary checkpointed edit —
   * unlike {@link setSchema}, the undo timeline survives, so a clear is one
   * undo away from recovery (the toolbar's confirm dialog promises exactly
   * that).
   */
  clearSchema: () => void;
  patchSchema: (patch: FormSchemaPatch) => void;
  selectNode: (id: string | null) => void;
  /**
   * Switch the left sidebar tab (no-op outside edit mode).
   */
  setSidebarTab: (tab: SidebarTabId) => void;
  /**
   * Switch the left sidebar to `数据` and open the entry's edit modal (no-op
   * outside edit mode).
   */
  requestDataEdit: (entry: DataEntryRef) => void;
  /**
   * Clear a consumed {@link pendingDataEdit} request.
   */
  clearPendingDataEdit: () => void;
  /**
   * Navigate the right properties panel to a specific linkage rule (and
   * optional step inside it), selecting the owning node or switching to the
   * `表单` tab as needed (no-op outside edit mode).
   */
  requestLinkageFocus: (focus: LinkageFocusRef) => void;
  /**
   * Clear a consumed {@link pendingLinkageFocus} request.
   */
  clearPendingLinkageFocus: () => void;
  /**
   * Switch the right properties panel's top-level tab and open the narrow
   * right overlay (no-op outside edit mode, or when `"control"` is requested
   * with no node selected).
   */
  setPropertiesTab: (tab: PropertiesTabId) => void;
  /**
   * Open or collapse the narrow-layout right properties overlay (no-op outside
   * edit mode).
   */
  setPropertiesDrawerOpen: (open: boolean) => void;
  setViewMode: (mode: EditorViewMode) => void;
  setDevice: (device: EditorDeviceMode) => void;
  /**
   * Replace the mobile presentation wholesale and switch editing to it: a blank
   * start, or a sync from the PC design (the caller builds the layer). An
   * ordinary checkpointed mutation: a single undo brings the previous mobile
   * presentation back, or the no-mobile seed screen where there was none.
   */
  replaceMobile: (layer: PresentationLayer) => void;

  /**
   * Insert a new field built from a registry definition at a drop target.
   * Inserting on an undesigned mobile device materializes the mobile
   * presentation as part of the same step, so a single undo returns to the
   * seed screen.
   */
  insertField: (args: { definition: FieldDefinition; target?: DropTarget }) => void;
  /**
   * Move an existing node (field or container) to a drop target.
   */
  moveNode: (args: { nodeId: string; target: DropTarget }) => void;
  /**
   * Remove a node (field or container) by id. Linkage references to the keys
   * that die with the removed subtree are pruned in the same undo step (rules
   * whose condition or last action pointed at them are removed), including the
   * form-level linkage when root-scope pc keys are affected.
   */
  removeNode: (nodeId: string) => void;
  /**
   * Remove one tab of a tabs container, together with its whole body. Runs the
   * same reference prune and selection cleanup as {@link removeNode} — a tab
   * body is a subtree, and dropping it through a plain block update left every
   * surviving rule pointing at keys that no longer existed, then silently
   * rebound those rules when the freed key was handed to a new field. A tabs
   * container always keeps at least one tab, so removing the last one is a
   * no-op.
   */
  removeTab: (tabsId: string, tabId: string) => void;
  /**
   * Deep-clone a node (fresh ids, fresh keys) and drop it on a new row right
   * below its source.
   */
  duplicateNode: (nodeId: string) => void;
  /**
   * Set a block's column span.
   */
  setSpan: (args: { nodeId: string; span: number | undefined }) => void;
  /**
   * Set a block's per-slot flex sizing (used inside a flex container).
   */
  setFlex: (args: { nodeId: string; flex: FlexSlot | undefined }) => void;
  /**
   * Set a block's fixed column width (used when the block is a column of a table
   * subform).
   */
  setColumnWidth: (args: { nodeId: string; width: number | undefined }) => void;
  /**
   * Set a block's stack sizing + placement (used when the block is a direct child
   * of a stack body — root / section / tab / stack subform).
   */
  setStackSlot: (args: { nodeId: string; slot: StackSlot | undefined }) => void;
  /**
   * Apply a pure updater to a single leaf field. The properties panel forwards
   * updaters from each `PropertyEntry.write` lens, keeping the action
   * property-agnostic while per-property type safety lives at the entry's
   * declaration site. Any data-contract property that changed (`validate`,
   * `dataSource`, `columnType`, `precision`, upload `maxCount`) propagates to
   * the same-scope, same-key twin on the other device presentation within the
   * same undo step; purely presentational edits stay device-local. Date
   * granularity is switched through `setDateGranularity`, which also
   * scrubs the linkage literals the switch invalidates.
   */
  editField: (args: { fieldId: string; updater: (field: FormField) => FormField }, options?: EditCoalesceOptions) => void;
  /**
   * Set a keyed leaf field's data-binding key from raw user input: sanitize it,
   * keep the current key when the input sanitizes to empty, and de-duplicate it
   * within the field's value scope. Linkage references to the old key in that
   * scope follow the rename (including the form-level linkage for root-scope pc
   * keys), so the editor never leaves them dangling.
   */
  setFieldKey: (args: { fieldId: string; key: string }) => void;
  /**
   * Switch a `date` or `daterange` field's calendar granularity (`year` /
   * `quarter` / `month` / `day`, with `"day"` normalized to omitted), sync its
   * same-key, same-type twin on the other device presentation, and scrub
   * incompatible linkage literals in its value scope (and in the PC root
   * `schema.linkage` when affected) — all in one undo step. A no-op when the
   * field is missing, not a date/daterange field, or nothing changes.
   */
  setDateGranularity: (args: { fieldId: string; granularity: DateGranularity }) => void;
  /**
   * Apply a pure updater to any node (field or container) by id. For keyed
   * nodes (keyed leaf fields and subforms), data-contract edits (such as
   * subform `rows` mode / `itemKey` / `source` / `required` / `min` / `max`)
   * propagate to the same-scope, same-key twin on the other device presentation
   * within the same undo step; presentational properties stay device-local.
   */
  updateBlock: (args: { nodeId: string; updater: (node: Block) => Block }, options?: EditCoalesceOptions) => void;

  /**
   * Insert a data source or replace the one with its id, in one undo step.
   */
  saveDataSource: (source: FormDataSource, options?: SaveDataEntryOptions) => void;
  /**
   * Insert a form variable or replace the one with its id, in one undo step.
   * Changing the name rewrites every `$vars` / `set_variable` reference along
   * with the declaration. No-ops on a name that is not an identifier or that
   * another variable holds.
   */
  saveVariable: (variable: FormVariable, options?: SaveDataEntryOptions) => void;
  /**
   * Remove a form variable declaration. The declaration only: a `set_variable`
   * action to an undeclared name remains semantically valid at runtime (the
   * `$vars` store accepts any name), so actions are deliberately left intact.
   * A no-op when no variable has the id.
   */
  removeVariable: (id: string) => void;
  /**
   * Remove a form-global data source declaration and prune every reference to
   * it: field `ref` option sources lose their `dataSource`, and
   * `refresh_data_source` actions naming it are dropped (rules emptied by the
   * drop are removed). A no-op when the id is not declared.
   */
  removeDataSource: (id: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export type FormEditorStoreApi = UnboundStore<FormEditorStoreState>;

export function isSidebarVisible(state: Pick<FormEditorStoreState, "viewMode">): boolean {
  return state.viewMode === "edit";
}

/**
 * Build a fresh block from a registry definition: a per-type id (containers get
 * their own prefixes via {@link idPrefixForType}, matching the clone/move
 * rebuild in `edit-ops.ts`) plus a scope-unique key for keyed types.
 *
 * The final widening cast is the single seam where the registry's type-erased
 * `create()` result rejoins the `Block` union: `DistributedOmit` cannot be
 * re-narrowed to a concrete member, but the result is well-formed by
 * construction — `id` is engine-minted and `key` is allocated exactly when the
 * definition declares itself keyed.
 */
function buildField(definition: FieldDefinition, layer: PresentationLayer, scope: ScopePath): Block {
  const base: FieldCreateResult & { id: string; key?: string } = {
    ...definition.config.create(),
    id: createId(idPrefixForType(definition.config.type))
  };

  if (definition.config.keyed) {
    // The type discriminator may contain charset the key grammar forbids
    // (e.g. "code-editor"); sanitize so a minted key always passes
    // validateSchema's KEY_CHARSET check.
    base.key = generateUniqueKey(layer, sanitizeKey(definition.config.type) || "field", scope);
  }

  return base as Block;
}

/**
 * Replace the entry holding `entry`'s id, or insert it — right after the entry
 * with id `after`, else at the end.
 */
function upsertEntry<T extends { id: string }>(entries: readonly T[], entry: T, after: string | undefined): T[] {
  if (entries.some(candidate => candidate.id === entry.id)) {
    return entries.map(candidate => candidate.id === entry.id ? entry : candidate);
  }

  const index = entries.findIndex(candidate => candidate.id === after);

  return index === -1 ? [...entries, entry] : entries.toSpliced(index + 1, 0, entry);
}

const CLEARED_SELECTION = {
  selectedId: null,
  propertiesTab: "form",
  propertiesDrawerOpen: false
} as const;

/**
 * Opening a sidebar overlay closes the properties one: a narrow layout shows a
 * single overlay over the canvas at a time.
 */
function sidebarPatch(tab: SidebarTabId): { sidebarTab: SidebarTabId; propertiesDrawerOpen?: false } {
  return tab === "palette" ? { sidebarTab: tab } : { sidebarTab: tab, propertiesDrawerOpen: false };
}

function selectPatch(nodeId: string): {
  selectedId: string;
  propertiesTab: "control";
  propertiesDrawerOpen: true;
} {
  return {
    selectedId: nodeId,
    propertiesTab: "control",
    propertiesDrawerOpen: true
  };
}

const result: ReturnedComponentStoreResult<FormEditorStoreState, { schema?: FormSchema }> = createComponentStore<
  FormEditorStoreState,
  { schema?: FormSchema }
>(
  "FormEditor",
  (set, get) => {
    /**
     * Coalescing key for the current run of property edits. Consecutive edits
     * sharing a key (e.g. keystrokes in one field's label) fold into a single
     * undo entry; any structural action, selection change, view-mode or device
     * switch, or undo/redo resets it so the next edit starts a fresh entry.
     */
    let coalesceKey: string | null = null;

    function pushHistory(): void {
      const {
        device,
        past,
        schema
      } = get();
      const entry: HistoryEntry = { schema, device };
      // The future never outgrows the limit on its own: pushHistory clears it,
      // and undo/redo only shuttle entries between the two stacks — so the
      // combined timeline stays bounded by trimming `past` here alone.
      const next = past.length >= HISTORY_LIMIT
        ? [...past.slice(past.length - HISTORY_LIMIT + 1), entry]
        : [...past, entry];

      set({ past: next, future: [] });
    }

    /**
     * Snapshot the current schema as a fresh, non-coalescing undo entry.
     */
    function checkpoint(): void {
      coalesceKey = null;
      pushHistory();
    }

    /**
     * Snapshot only when this edit does not continue the previous one (same
     * `key`), so a stream of keystrokes collapses into one undoable step.
     *
     * `undefined` means "this edit continues nothing": it always snapshots and
     * leaves no key behind, so the NEXT edit snapshots too. Folding is opt-in
     * by naming the thing being edited — a default key derived from the node
     * would fold every discrete action on it (three 新增标签 clicks into one
     * undo step, a 删除标签 with the gap change after it) which no caller wants.
     */
    function checkpointCoalescing(key: string | undefined): void {
      if (key !== undefined && coalesceKey === key) {
        return;
      }

      pushHistory();
      coalesceKey = key ?? null;
    }

    return {
      schema: createEmptySchema(),
      selectedId: null,
      sidebarTab: "palette",
      propertiesTab: "form",
      propertiesDrawerOpen: false,
      pendingDataEdit: null,
      pendingLinkageFocus: null,
      viewMode: "edit",
      device: "pc",
      past: [],
      future: [],

      setSchema: schema => {
        // A wholesale replace (import / external set) invalidates the timeline
        // — its snapshots belong to the previous document.
        coalesceKey = null;
        set({
          schema,
          ...CLEARED_SELECTION,
          pendingDataEdit: null,
          pendingLinkageFocus: null,
          past: [],
          future: []
        });
      },

      clearSchema: () => {
        checkpoint();
        set({
          schema: createEmptySchema(),
          ...CLEARED_SELECTION,
          pendingDataEdit: null,
          pendingLinkageFocus: null
        });
      },

      patchSchema: patch => {
        const { device, schema } = get();
        const {
          gap,
          ...shared
        } = patch;

        // A patch that changes nothing must not push an undo entry (or a
        // fresh schema identity) — every other mutator reports identity the
        // same way. Shared keys compare by reference; `gap` against the
        // active device's layer.
        const sharedChanged = (Object.keys(shared) as Array<keyof typeof shared>)
          .some(key => schema[key] !== shared[key]);
        // Only against a presentation that EXISTS: `currentLayer` falls back to
        // an empty layer for an undesigned device, and writing a gap onto that
        // fallback materializes the presentation — replacing the mobile seed
        // state (and its one-click convert-from-PC entry) with an empty canvas.
        // Materializing stays reserved for an explicit seed or the first insert.
        const gapChanged = "gap" in patch
          && resolvePresentation(schema, device) !== undefined
          && currentLayer(schema, device).gap !== gap;

        if (!sharedChanged && !gapChanged) {
          return;
        }

        // Form linkage commits are discrete modal saves / duplicates / deletes,
        // never a stream of keystrokes — keep each one its own undo step.
        if (Object.hasOwn(shared, "linkage")) {
          checkpoint();
        } else {
          checkpointCoalescing(`form:${Object.keys(patch).toSorted().join(",")}`);
        }

        const next: FormSchema = { ...schema, ...shared };

        // Clearing an optional collection (linkage / variables / data sources)
        // patches `key: undefined`; drop the key rather than leaving a dangling
        // `undefined` value on the schema.
        for (const key of ["linkage", "variables", "dataSources"] as const) {
          if (Object.hasOwn(shared, key) && shared[key] === undefined) {
            delete next[key];
          }
        }

        // `id` is required on FormSchema; the patch type only widens it because
        // `Partial<Pick<…>>` cannot express "present or absent, never
        // undefined". Writing the undefined through would leave the store with
        // a schema export rejects as `id_required`.
        if (next.id === undefined) {
          next.id = schema.id;
        }

        // `gap` is a layout default of the active device's presentation, not
        // shared form metadata — route it there (skipped when the patched gap
        // is already in place, so the layer keeps its identity).
        if (gapChanged) {
          const layer: PresentationLayer = { ...currentLayer(next, device) };

          if (gap === undefined) {
            delete layer.gap;
          } else {
            layer.gap = gap;
          }

          set({ schema: withPresentation(next, device, layer) });
          return;
        }

        set({ schema: next });
      },

      selectNode: id => {
        coalesceKey = null;

        if (get().viewMode !== "edit" || id === null) {
          set(CLEARED_SELECTION);
          return;
        }

        const { device, schema } = get();
        const node = findNode(currentLayer(schema, device), id);

        // A stale id is not selectable; clear the selection and revert the
        // right panel to form-level settings.
        if (!node) {
          set(CLEARED_SELECTION);
          return;
        }

        set(selectPatch(id));
      },

      setSidebarTab: tab => {
        if (get().viewMode !== "edit") {
          return;
        }

        set(sidebarPatch(tab));
      },

      requestDataEdit: entry => {
        if (get().viewMode !== "edit") {
          return;
        }

        // A fresh object each time, so repeating a jump to the same entry is a
        // new request.
        set({ ...sidebarPatch("data"), pendingDataEdit: { ...entry } });
      },

      clearPendingDataEdit: () => {
        if (get().pendingDataEdit !== null) {
          set({ pendingDataEdit: null });
        }
      },

      requestLinkageFocus: focus => {
        const {
          device,
          schema,
          viewMode
        } = get();

        if (viewMode !== "edit") {
          return;
        }

        if (focus.nodeId === null) {
          set({
            propertiesTab: "form",
            propertiesDrawerOpen: true,
            pendingLinkageFocus: { ...focus }
          });
          return;
        }

        if (findNode(currentLayer(schema, device), focus.nodeId) === undefined) {
          return;
        }

        coalesceKey = null;
        set({
          ...selectPatch(focus.nodeId),
          pendingLinkageFocus: { ...focus }
        });
      },

      clearPendingLinkageFocus: () => {
        if (get().pendingLinkageFocus !== null) {
          set({ pendingLinkageFocus: null });
        }
      },

      setPropertiesTab: tab => {
        const { selectedId, viewMode } = get();

        if (viewMode !== "edit") {
          return;
        }

        if (tab === "control" && selectedId === null) {
          return;
        }

        set({ propertiesTab: tab, propertiesDrawerOpen: true });
      },

      setPropertiesDrawerOpen: open => set({
        propertiesDrawerOpen: open && get().viewMode === "edit"
      }),

      setViewMode: mode => {
        // A view-mode round trip ends any running property-edit coalescing:
        // edits made before and after it are distinct undo steps.
        coalesceKey = null;

        if (mode !== "edit") {
          // Selection and panel tabs survive the round trip — peeking at the
          // preview or the JSON must not cost the designer their working state
          // (non-edit surfaces simply hide both side panels). The narrow-layout
          // right overlay is edit-only chrome, so it closes on exit.
          set({
            viewMode: mode,
            propertiesDrawerOpen: false,
            pendingDataEdit: null,
            pendingLinkageFocus: null
          });
          return;
        }

        set({ viewMode: mode });
      },

      setDevice: device => {
        const { schema, selectedId } = get();
        const layer = currentLayer(schema, device);
        // The selection belongs to the previous device's tree; keep it only if
        // an identically-id'd node also exists in the new device's tree
        // (normally it does not, since the two trees have independent ids).
        const keep = selectedId !== null && findNode(layer, selectedId) ? selectedId : null;

        coalesceKey = null;

        if (keep === null) {
          set({ device, ...CLEARED_SELECTION });
          return;
        }

        set({ device, selectedId: keep });
      },

      replaceMobile: layer => {
        const { schema } = get();

        checkpoint();
        set({
          schema: withPresentation(schema, "mobile", layer),
          device: "mobile",
          ...CLEARED_SELECTION
        });
      },

      insertField: ({ definition, target }) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        const dropTarget = target ?? { kind: "append" };
        const block = buildField(definition, layer, targetScope(layer, dropTarget));
        const next = insertBlock(layer, block, dropTarget);

        // insertBlock returns the input reference when the target cannot be
        // resolved (a stale anchor / container id). Without this guard a stale
        // drop would push a junk history entry and select an id that never
        // landed in the tree.
        if (next === layer) {
          return;
        }

        checkpoint();
        set({
          schema: withPresentation(schema, device, next),
          ...selectPatch(block.id)
        });
      },

      moveNode: ({ nodeId, target }) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        const node = findNode(layer, nodeId);

        if (!node) {
          return;
        }

        const sourceScope = findScope(layer, nodeId) ?? [];
        const next = moveBlock(layer, nodeId, target);

        // moveBlock returns the same reference for a no-op (missing node, self /
        // descendant drop, stale target) — skip the history entry in that case.
        if (next === layer) {
          return;
        }

        let nextLayer = next;
        let nextSchema = withPresentation(schema, device, nextLayer);
        const destScope = findScope(nextLayer, nodeId) ?? [];

        // A cross-scope move takes the subtree's keys out of the source scope.
        // For the rules that stayed behind this is indistinguishable from a
        // removal, so the same reference prune runs in the same undo step —
        // the moved subtree itself now resolves under the destination scope,
        // which the prune's scope namespacing leaves untouched.
        if (!scopeEquals(sourceScope, destScope)) {
          const departedKeyBuckets = collectSubtreeKeysByScope(node, sourceScope);

          nextLayer = pruneScopedReferences(nextLayer, departedKeyBuckets);
          nextSchema = withPresentation(schema, device, nextLayer);

          // Form-level linkage and remote dataSources resolve against the PC
          // root scope: prune them when root-scope PC keys moved away.
          if (device === "pc") {
            nextSchema = pruneFormRootKeyReferences(nextSchema, departedKeyBuckets);
          }
        }

        // Select the moved node, mirroring insertField / duplicateNode: a drop
        // is a deliberate placement, so the block the designer just positioned
        // stays selected (and the canvas scrolls it into view). The node still
        // resolves — it was moved, not removed — so the id is always live here.
        checkpoint();
        set({ schema: nextSchema, ...selectPatch(nodeId) });
      },

      removeNode: nodeId => {
        const {
          device,
          schema,
          selectedId
        } = get();
        const layer = currentLayer(schema, device);
        const node = findNode(layer, nodeId);

        if (!node) {
          return;
        }

        // The keys that die with the subtree, per value scope — collected
        // before the removal so the prune can chase their references.
        const baseScope = findScope(layer, nodeId) ?? [];
        const removedKeyBuckets = collectSubtreeKeysByScope(node, baseScope);

        // Prune linkage references to the removed keys in each affected scope,
        // so the schema the editor emits never carries dangling references.
        const nextLayer = pruneScopedReferences(removeNodeOp(layer, nodeId), removedKeyBuckets);

        let nextSchema = withPresentation(schema, device, nextLayer);

        // Form-level linkage and remote dataSources resolve against the PC root
        // scope: prune them when root-scope PC keys died. Mobile keys never
        // touch them.
        if (device === "pc") {
          nextSchema = pruneFormRootKeyReferences(nextSchema, removedKeyBuckets);
        }

        // The removed node may have contained the selection — clear it whenever
        // it no longer resolves in the pruned tree, not only on an exact match.
        const selectionSurvives = selectedId !== null && findNode(nextLayer, selectedId) !== undefined;

        checkpoint();
        set({
          schema: nextSchema,
          ...selectionSurvives ? { selectedId } : CLEARED_SELECTION
        });
      },

      removeTab: (tabsId, tabId) => {
        const {
          device,
          schema,
          selectedId
        } = get();
        const layer = currentLayer(schema, device);
        const removal = removeTabBody(layer, tabsId, tabId);

        if (!removal) {
          return;
        }

        const nextLayer = pruneScopedReferences(removal.layer, removal.buckets);

        let nextSchema = withPresentation(schema, device, nextLayer);

        if (device === "pc") {
          nextSchema = pruneFormRootKeyReferences(nextSchema, removal.buckets);
        }

        const selectionSurvives = selectedId !== null && findNode(nextLayer, selectedId) !== undefined;

        checkpoint();
        set({
          schema: nextSchema,
          ...selectionSurvives ? { selectedId } : CLEARED_SELECTION
        });
      },

      duplicateNode: nodeId => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        const source = findNode(layer, nodeId);

        if (!source) {
          return;
        }

        // The clone lands as a sibling right after the source, so it shares the
        // source's value scope; allocate its keys against that scope only.
        const scope = findScope(layer, nodeId) ?? [];
        const used = collectScopeKeys(layer, scope);
        const clone = cloneBlock(source, base => nextUniqueKey(used, base));
        const next = insertBlock(layer, clone, {
          kind: "beside",
          anchorId: nodeId,
          side: "after"
        });

        checkpoint();
        set({
          schema: withPresentation(schema, device, next),
          ...selectPatch(clone.id)
        });
      },

      setSpan: ({ nodeId, span }) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        // The op normalizes (floor + clamp) before comparing, so identity — not
        // a raw input comparison — is the no-op signal.
        const next = setSpanOp(layer, nodeId, span);

        if (next === layer) {
          return;
        }

        // Coalesced like every property edit: these are driven per keystroke
        // from InputNumber fields, and one undo must revert the typed value,
        // not one digit of it.
        checkpointCoalescing(`span:${nodeId}`);
        set({ schema: withPresentation(schema, device, next) });
      },

      setFlex: ({ nodeId, flex }) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        const next = setFlexOp(layer, nodeId, flex);

        if (next === layer) {
          return;
        }

        checkpointCoalescing(`flex:${nodeId}`);
        set({ schema: withPresentation(schema, device, next) });
      },

      setColumnWidth: ({ nodeId, width }) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        // The op normalizes (floor + clamp) before comparing, so identity — not
        // a raw input comparison — is the no-op signal.
        const next = setColumnWidthOp(layer, nodeId, width);

        if (next === layer) {
          return;
        }

        checkpointCoalescing(`column-width:${nodeId}`);
        set({ schema: withPresentation(schema, device, next) });
      },

      setStackSlot: ({ nodeId, slot }) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        // The op normalizes and compares by identity, so an unchanged slot is a
        // no-op — no history entry, no fresh schema identity.
        const next = setStackSlotOp(layer, nodeId, slot);

        if (next === layer) {
          return;
        }

        checkpointCoalescing(`stack:${nodeId}`);
        set({ schema: withPresentation(schema, device, next) });
      },

      editField: ({ fieldId, updater }, options) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        const before = findField(layer, fieldId);

        if (!before) {
          return;
        }

        const next = editFieldOp(layer, fieldId, updater);

        // Identity contract: a missing id or an updater that returned its input
        // changes nothing — push no history entry.
        if (next === layer) {
          return;
        }

        let nextSchema = withPresentation(schema, device, next);
        const after = findField(next, fieldId);

        if (after !== undefined) {
          nextSchema = syncEditedNodeToTwin({
            schema: nextSchema,
            device,
            beforeLayer: layer,
            nodeId: fieldId,
            before,
            after
          });
        }

        checkpointCoalescing(options?.coalesceKey);
        set({ schema: nextSchema });
      },

      setFieldKey: ({ fieldId, key }) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        const field = findField(layer, fieldId);

        // `key` in the field, not `isKeyedField`: the latter is a VALUE guard
        // (non-empty string), so it refused the one field that most needs a key
        // set — an imported one whose key is empty, which `validateSchema`
        // flags as `key_required` and which no other action can repair.
        if (!field || !("key" in field)) {
          return;
        }

        const scope = findScope(layer, fieldId) ?? [];
        const sanitized = sanitizeKey(key);
        // An all-invalid input sanitizes to empty — keep the current key rather
        // than dropping the field's binding. A field that has no key yet has
        // nothing to keep, so it falls back to its type instead of staying
        // unusable.
        const base = sanitized.length > 0 ? sanitized : field.key || sanitizeKey(field.type);
        // Unique within the scope across BOTH presentations. The two device
        // trees are designed independently, but the data layer is shared — the
        // projection dedupes root-scope keys across them — so renaming onto a
        // key the other device already binds to a DIFFERENT field would merge
        // two fields into one.
        const used = collectScopeKeysAcrossDevices(schema, scope);

        used.delete(field.key);

        const unique = nextUniqueKey(used, base);

        if (unique === field.key) {
          return;
        }

        const previousKey = field.key;
        // Linkage references in the field's value scope follow the rename, so
        // sibling rules keep pointing at the same field.
        const nextLayer = renameKeyReferences(
          editFieldOp(layer, fieldId, current => ({ ...current, key: unique } as FormField)),
          scope,
          previousKey,
          unique
        );
        let nextSchema = withPresentation(schema, device, nextLayer);

        // A field carrying the same key at the same scope on the other device
        // IS this field — the trees differ, the data layer does not — so the
        // rename follows it there, or the two presentations would project as
        // two separate fields and hand the backend a phantom. A device that
        // simply does not carry this field is a legitimate design difference
        // and is left untouched.
        const otherDevice: PresentationDevice = device === "pc" ? "mobile" : "pc";
        const otherLayer = resolvePresentation(nextSchema, otherDevice);
        const candidate = otherLayer === undefined ? undefined : findKeyedNodeByKeyInScope(otherLayer, scope, previousKey);
        const twin = candidate !== undefined && isLeafField(candidate) ? candidate : undefined;

        if (otherLayer !== undefined && twin !== undefined) {
          nextSchema = withPresentation(nextSchema, otherDevice, renameKeyReferences(
            editFieldOp(otherLayer, twin.id, current => ({ ...current, key: unique } as FormField)),
            scope,
            previousKey,
            unique
          ));
        }

        // The form-level linkage resolves against the PC root scope, so it
        // reconciles whenever the PC key changed — whether this rename started
        // there or reached it through the twin above.
        const pcKeyChanged = device === "pc" || (twin !== undefined && otherDevice === "pc");

        if (pcKeyChanged && scope.length === 0) {
          nextSchema = renameFormRootKeyReferences(nextSchema, previousKey, unique);
        }

        checkpointCoalescing(`field-key:${fieldId}`);
        set({ schema: nextSchema });
      },

      setDateGranularity: ({ fieldId, granularity }) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        const field = findField(layer, fieldId);

        if (!field || !isDateGranularityField(field)) {
          return;
        }

        const scope = findScope(layer, fieldId) ?? [];
        const target: DateGranularityScrubTarget = {
          key: field.key,
          fieldType: field.type,
          nextGranularity: granularity
        };

        let nextSchema = schema;
        const nextLayer = applyGranularityToLayer(layer, scope, fieldId, target);

        if (nextLayer !== layer) {
          nextSchema = withPresentation(nextSchema, device, nextLayer);
        }

        // Sync the cross-device twin (same key, same scope, same date/daterange
        // type) so PC and mobile never drift on granularity, and scrub its
        // scope's incompatible linkage literals in the same undo step.
        const {
          otherDevice,
          otherLayer,
          twin
        } = findDateGranularityTwin(nextSchema, device, scope, field);

        if (otherLayer !== undefined && twin !== undefined) {
          const nextOtherLayer = applyGranularityToLayer(otherLayer, scope, twin.id, target);

          if (nextOtherLayer !== otherLayer) {
            nextSchema = withPresentation(nextSchema, otherDevice, nextOtherLayer);
          }
        }

        const pcRootAffected = scope.length === 0 && (device === "pc" || twin !== undefined);

        if (pcRootAffected && nextSchema.linkage !== undefined) {
          const linkage = scrubLinkageDateLiterals(nextSchema.linkage, target);

          if (linkage !== nextSchema.linkage) {
            nextSchema = { ...nextSchema, linkage };
          }
        }

        if (nextSchema === schema) {
          return;
        }

        checkpoint();
        set({ schema: nextSchema });
      },

      updateBlock: ({ nodeId, updater }, options) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        const before = findNode(layer, nodeId);

        if (!before) {
          return;
        }

        const next = updateNodeOp(layer, nodeId, updater);

        if (next === layer) {
          return;
        }

        let nextSchema = withPresentation(schema, device, next);
        const after = findNode(next, nodeId);

        if (after !== undefined) {
          nextSchema = syncEditedNodeToTwin({
            schema: nextSchema,
            device,
            beforeLayer: layer,
            nodeId,
            before,
            after
          });
        }

        checkpointCoalescing(options?.coalesceKey);
        set({ schema: nextSchema });
      },

      saveDataSource: (source, options) => {
        const { schema } = get();

        checkpoint();
        set({
          schema: {
            ...schema,
            dataSources: upsertEntry(schema.dataSources ?? [], source, options?.after)
          }
        });
      },

      saveVariable: (variable, options) => {
        const { schema } = get();
        const variables = schema.variables ?? [];

        if (
          !isValidVariableName(variable.name)
          || variables.some(candidate => candidate.id !== variable.id && candidate.name === variable.name)
        ) {
          return;
        }

        const previousName = variables.find(candidate => candidate.id === variable.id)?.name;
        const renamed = previousName === undefined || previousName.length === 0 || previousName === variable.name
          ? schema
          : renameVariableReferences(schema, previousName, variable.name);

        checkpoint();
        set({
          schema: {
            ...renamed,
            variables: upsertEntry(variables, variable, options?.after)
          }
        });
      },

      removeVariable: id => {
        const { schema } = get();
        const variables = schema.variables ?? [];

        if (variables.every(variable => variable.id !== id)) {
          return;
        }

        const remaining = variables.filter(variable => variable.id !== id);
        const nextSchema: FormSchema = { ...schema, variables: remaining };

        // An emptied optional collection drops its key (the patchSchema
        // convention) rather than persisting `[]` noise.
        if (remaining.length === 0) {
          delete nextSchema.variables;
        }

        checkpoint();
        set({ schema: nextSchema });
      },

      removeDataSource: id => {
        const { schema } = get();
        const dataSources = schema.dataSources ?? [];

        if (dataSources.every(source => source.id !== id)) {
          return;
        }

        const remaining = dataSources.filter(source => source.id !== id);
        const nextSchema: FormSchema = {
          ...pruneDataSourceReferences(schema, id),
          dataSources: remaining
        };

        if (remaining.length === 0) {
          delete nextSchema.dataSources;
        }

        checkpoint();
        set({ schema: nextSchema });
      },

      undo: () => {
        const {
          future,
          past,
          schema,
          selectedId
        } = get();
        const previous = past.at(-1);

        if (previous === undefined) {
          return;
        }

        coalesceKey = null;

        // Undo jumps the view to the device the restored change happened on;
        // the selection survives only if it still resolves there.
        const restoredLayer = currentLayer(previous.schema, previous.device);
        const keepSelection = selectedId !== null && findNode(restoredLayer, selectedId) !== undefined;

        set({
          schema: previous.schema,
          device: previous.device,
          past: past.slice(0, -1),
          // The entry we push carries the device the state being LEFT belongs
          // to — which is the device the edit that produced it happened on,
          // i.e. `previous.device`. Stamping the live view device instead meant
          // undoing after a device switch pushed the wrong device, and the
          // matching redo then jumped the view to a presentation the change was
          // never made on (an undesigned one shows its seed state, so the redo
          // looks like it did nothing).
          future: [...future, { schema, device: previous.device }],
          ...keepSelection ? { selectedId } : CLEARED_SELECTION
        });
      },

      redo: () => {
        const {
          future,
          past,
          schema,
          selectedId
        } = get();
        const next = future.at(-1);

        if (next === undefined) {
          return;
        }

        coalesceKey = null;

        const restoredLayer = currentLayer(next.schema, next.device);
        const keepSelection = selectedId !== null && findNode(restoredLayer, selectedId) !== undefined;

        set({
          schema: next.schema,
          device: next.device,
          past: [...past, { schema, device: next.device }],
          future: future.slice(0, -1),
          ...keepSelection ? { selectedId } : CLEARED_SELECTION
        });
      },

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0
    };
  }
);

export const FormEditorStoreProvider = result.StoreProvider;
export const useFormEditorStoreApi = result.useStoreApi;
export const useFormEditorStore = result.useStore;

/**
 * The presentation layer for the active device. Editor surfaces (outline, footer
 * count, properties, toolbar) read the current device's tree through this rather
 * than reaching into `schema.presentations` themselves. An undesigned mobile
 * device resolves to the shared empty layer, so the value identity is stable.
 */
export function useCurrentLayer(): PresentationLayer {
  return useFormEditorStore(state => currentLayer(state.schema, state.device));
}

/**
 * Memoize a pure per-layer computation by layer **identity**. Every edit mints a
 * new layer reference (structural sharing), so the cache never serves a stale
 * value — it is purely deduplication: the many re-renders between edits, and the
 * multiple subscribers, share one tree walk instead of re-walking hundreds of
 * fields per render. Module-private; the count selectors below are its only
 * users.
 */
function memoizeByLayer<T>(compute: (layer: PresentationLayer) => T): (layer: PresentationLayer) => T {
  const cache = new WeakMap<PresentationLayer, T>();

  return layer => {
    const cached = cache.get(layer);

    if (cached !== undefined) {
      return cached;
    }

    const value = compute(layer);

    cache.set(layer, value);

    return value;
  };
}

const fieldCountOfLayer = memoizeByLayer(countFields);

/**
 * Field count of the active device's presentation, for `useFormEditorStore`
 * subscribers (toolbar / footer stats). Layer-identity memoized.
 */
/**
 * The keys bound directly within one value scope, across BOTH presentations.
 *
 * A key is the data layer, which the two device trees share: the projection
 * (`walkUniqueRootKeyedFields`) folds root-scope fields from pc and mobile into
 * ONE inventory deduped by key. Checking uniqueness per device would let a
 * rename land on a key the other device binds to a different field, silently
 * merging the two.
 */
function collectScopeKeysAcrossDevices(schema: FormSchema, scope: ScopePath): Set<string> {
  const keys = collectScopeKeys(schema.presentations.pc, scope);

  if (schema.presentations.mobile !== undefined) {
    for (const key of collectScopeKeys(schema.presentations.mobile, scope)) {
      keys.add(key);
    }
  }

  return keys;
}

/**
 * Propagate data-contract changes from an edited node on `device` onto its
 * same-scope, same-key twin on the opposite presentation (when one exists).
 * Presentation trees may differ, but the data layer is shared — keeping twin
 * contract properties aligned prevents the two devices from drifting apart on
 * the same binding. Purely presentational edits bail before walking either tree.
 */
function syncEditedNodeToTwin({
  after,
  before,
  beforeLayer,
  device,
  nodeId,
  schema
}: {
  schema: FormSchema;
  device: PresentationDevice;
  beforeLayer: PresentationLayer;
  nodeId: string;
  before: Block;
  after: Block;
}): FormSchema {
  if (!hasNodeContractChange(before, after) || !isKeyedNode(before)) {
    return schema;
  }

  const otherDevice: PresentationDevice = device === "pc" ? "mobile" : "pc";
  const otherLayer = resolvePresentation(schema, otherDevice);

  if (otherLayer === undefined) {
    return schema;
  }

  const scope = findScope(beforeLayer, nodeId) ?? [];
  const twin = findKeyedNodeByKeyInScope(otherLayer, scope, before.key);

  if (twin === undefined) {
    return schema;
  }

  const nextOtherLayer = updateNodeOp(otherLayer, twin.id, current => syncNodeContractToTwin(before, after, current));

  return nextOtherLayer === otherLayer ? schema : withPresentation(schema, otherDevice, nextOtherLayer);
}

function applyGranularityToLayer(
  layer: PresentationLayer,
  scope: ScopePath,
  fieldId: string,
  target: DateGranularityScrubTarget
): PresentationLayer {
  const updated = editFieldOp(
    layer,
    fieldId,
    current => isDateGranularityField(current) ? withFieldGranularity(current, target.nextGranularity) : current
  );

  return scrubDateLiterals(updated, scope, fieldId, target);
}

/**
 * Look up the cross-device twin of a `date` or `daterange` field — same key,
 * same value scope, and same field type on the opposite presentation — reusing
 * {@link findKeyedNodeByKeyInScope}.
 */
function findDateGranularityTwin(
  schema: FormSchema,
  device: PresentationDevice,
  scope: ScopePath,
  field: DateGranularityField
): {
  otherDevice: PresentationDevice;
  otherLayer: PresentationLayer | undefined;
  twin: DateGranularityField | undefined;
} {
  const otherDevice: PresentationDevice = device === "pc" ? "mobile" : "pc";
  const otherLayer = resolvePresentation(schema, otherDevice);
  const candidate = otherLayer === undefined ? undefined : findKeyedNodeByKeyInScope(otherLayer, scope, field.key);
  const twin = candidate !== undefined && isLeafField(candidate) && candidate.type === field.type ? candidate : undefined;

  return {
    otherDevice,
    otherLayer,
    twin
  };
}

/**
 * Report whether switching `fieldId` on `device` to another granularity would
 * discard any authored linkage literal anywhere in `schema` — across the active
 * presentation, its cross-device twin's presentation, and the PC root
 * `schema.linkage` when affected. Shares {@link findDateGranularityTwin} with
 * {@link FormEditorStoreState.setDateGranularity} so the confirmation prompt
 * and the mutation always cover the exact same scope and layers.
 */
export function hasDateGranularityLiterals(
  schema: FormSchema,
  device: EditorDeviceMode,
  fieldId: string
): boolean {
  const layer = resolvePresentation(schema, device);
  const field = layer === undefined ? undefined : findField(layer, fieldId);

  if (layer === undefined || field === undefined || !isDateGranularityField(field)) {
    return false;
  }

  const scope = findScope(layer, fieldId) ?? [];

  if (hasScopedDateLiterals(layer, scope, field.id, field.key)) {
    return true;
  }

  const { otherLayer, twin } = findDateGranularityTwin(schema, device, scope, field);

  if (otherLayer !== undefined && twin !== undefined && hasScopedDateLiterals(otherLayer, scope, twin.id, field.key)) {
    return true;
  }

  const pcRootAffected = scope.length === 0 && (device === "pc" || twin !== undefined);

  return pcRootAffected && schema.linkage !== undefined && hasLinkageDateLiterals(schema.linkage, field.key);
}

export function selectFieldCount(state: FormEditorStoreState): number {
  return fieldCountOfLayer(currentLayer(state.schema, state.device));
}

/**
 * Fields across BOTH presentations. What a whole-schema action (clearing,
 * importing) actually affects — `selectFieldCount` speaks for the device on
 * screen, which understates a form whose other device carries the design.
 */
export function selectTotalFieldCount(state: FormEditorStoreState): number {
  const { presentations } = state.schema;

  return fieldCountOfLayer(presentations.pc)
    + (presentations.mobile === undefined ? 0 : fieldCountOfLayer(presentations.mobile));
}

const fieldRuleCountOfLayer = memoizeByLayer((layer: PresentationLayer): number => {
  let fieldRules = 0;

  walkNodes(layer, node => {
    fieldRules += node.linkage?.rules?.length ?? 0;
  });

  return fieldRules;
});

/**
 * Total linkage rule count the designer has authored: field-level rules across
 * the active device's presentation PLUS the form-level event rules. The footer
 * shows this aggregate — counting only one kind silently misreports the other
 * (a form with five field rules is not "0 联动"). Only the field-level walk is
 * layer-identity memoized; the form-level rules are added outside the cache
 * because they live on the schema, not the layer.
 */
export function selectLinkageRuleCount(state: FormEditorStoreState): number {
  const layer = currentLayer(state.schema, state.device);

  return fieldRuleCountOfLayer(layer) + (state.schema.linkage?.rules?.length ?? 0);
}
