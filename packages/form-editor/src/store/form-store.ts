import type { ReturnedComponentStoreResult, UnboundStore } from "@vef-framework-react/core";

import type { DropTarget } from "../engine/schema/edit-ops";
import type { ScopePath } from "../engine/schema/walk";
import type { Block, FieldCreateResult, FieldDefinition, FlexSlot, FormField, FormSchema, GapScale, PresentationDevice, PresentationLayer, StackSlot } from "../types";

import { createComponentStore } from "@vef-framework-react/core";

import { createId, idPrefixForType } from "../engine/ids";
import { collectScopeKeys, collectSubtreeKeysByScope, generateUniqueKey, isKeyedField, nextUniqueKey, sanitizeKey } from "../engine/keys";
import { cloneBlock, insertBlock, moveBlock, setColumnWidth as setColumnWidthOp, setFlex as setFlexOp, setSpan as setSpanOp, setStackSlot as setStackSlotOp, targetScope } from "../engine/schema/edit-ops";
import {
  editField as editFieldOp,
  removeBlock as removeNodeOp,
  updateNode as updateNodeOp
} from "../engine/schema/mutate";
import { createEmptySchema } from "../engine/schema/nodes";
import { currentLayer, withPresentation } from "../engine/schema/presentation";
import {
  pruneDataSourceReferences,
  pruneFormLinkageForRootBucket,
  pruneScopedReferences,
  renameKeyReferences,
  renameLinkageKeyReferences,
  renameVariableReferences
} from "../engine/schema/reconcile";
import { isValidVariableName } from "../engine/schema/validate";
import { countFields, findField, findNode, findScope, scopeEquals, walkNodes } from "../engine/schema/walk";

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
 * Tab of the bottom form-config drawer. `outline` is the schema field tree;
 * `form` carries root metadata + layout + stats; the rest map one-to-one to the
 * form-global variables / data sources / linkage (the unified "events") panels.
 */
export type FormConfigTabId = "outline" | "form" | "variables" | "dataSources" | "linkage";

/**
 * The form-level metadata the form-config drawer patches. Shared fields (root
 * id, form-scope linkage, form-global variables / data sources) live on the
 * schema; `gap` is a layout default applied to the active device's presentation.
 */
export type FormSchemaPatch = Partial<Pick<FormSchema, "dataSources" | "id" | "linkage" | "variables">> & {
  gap?: GapScale;
};

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
   * into one undo step. Defaults to a per-node key (`field:<id>` /
   * `block:<id>`); pass a finer key (e.g. `field:<id>:<property>`) so edits to
   * different properties of one node stay separately undoable.
   */
  coalesceKey?: string;
}

export interface FormEditorStoreState {
  schema: FormSchema;
  /**
   * Currently selected node (field or container), or null for none. The docked
   * properties panel keys off this: a non-null selection shows that control's
   * editor, null shows the empty hint.
   */
  selectedId: string | null;
  /**
   * Whether the bottom form-config drawer is open. Independent of the
   * selection — both the drawer and a selected control can be active at once.
   */
  formConfigOpen: boolean;
  /**
   * Active tab of the bottom form-config drawer.
   */
  formConfigTab: FormConfigTabId;
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
   * Open or collapse the bottom form-config drawer (no-op outside edit mode).
   */
  setFormConfigOpen: (open: boolean) => void;
  /**
   * Switch the form-config drawer to a tab, opening it if collapsed (no-op
   * outside edit mode).
   */
  setFormConfigTab: (tab: FormConfigTabId) => void;
  setViewMode: (mode: EditorViewMode) => void;
  setDevice: (device: EditorDeviceMode) => void;
  /**
   * Seed the mobile presentation wholesale and switch editing to it. Used by
   * the canvas seed state to start from a blank layer or a best-effort
   * PC → mobile conversion (the caller builds the layer). An ordinary
   * checkpointed mutation: a single undo removes the seeded presentation
   * again, returning the canvas to the no-mobile seed screen.
   */
  initMobile: (layer: PresentationLayer) => void;

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
   * declaration site.
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
   * Apply a pure updater to any node (field or container) by id.
   */
  updateBlock: (args: { nodeId: string; updater: (node: Block) => Block }, options?: EditCoalesceOptions) => void;

  /**
   * Rename a form variable declaration and rewrite every `set_variable` action
   * targeting it (across both presentations and the form-level linkage). A
   * no-op when `name` is not declared, `nextName` is not an identifier-shaped
   * `$vars` name (see `isValidVariableName`), or `nextName` collides with an
   * existing declaration.
   */
  renameVariable: (name: string, nextName: string) => void;
  /**
   * Remove a form variable declaration. The declaration only: a `set_variable`
   * action to an undeclared name remains semantically valid at runtime (the
   * `$vars` store accepts any name), so actions are deliberately left intact.
   * A no-op when the name is not declared.
   */
  removeVariable: (name: string) => void;
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

export function isPaletteVisible(state: Pick<FormEditorStoreState, "viewMode">): boolean {
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
     */
    function checkpointCoalescing(key: string): void {
      if (coalesceKey === key) {
        return;
      }

      pushHistory();
      coalesceKey = key;
    }

    return {
      schema: createEmptySchema(),
      selectedId: null,
      formConfigOpen: false,
      formConfigTab: "outline",
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
          selectedId: null,
          past: [],
          future: []
        });
      },

      clearSchema: () => {
        checkpoint();
        set({
          schema: createEmptySchema(),
          selectedId: null
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
        const gapChanged = "gap" in patch && currentLayer(schema, device).gap !== gap;

        if (!sharedChanged && !gapChanged) {
          return;
        }

        checkpointCoalescing(`form:${Object.keys(patch).toSorted().join(",")}`);

        const next: FormSchema = { ...schema, ...shared };

        // Clearing an optional collection (linkage / variables / data sources)
        // patches `key: undefined`; drop the key rather than leaving a dangling
        // `undefined` value on the schema.
        for (const key of ["linkage", "variables", "dataSources"] as const) {
          if (Object.hasOwn(shared, key) && shared[key] === undefined) {
            delete next[key];
          }
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

        if (get().viewMode !== "edit") {
          set({ selectedId: null });
          return;
        }

        if (id !== null) {
          const { device, schema } = get();
          const node = findNode(currentLayer(schema, device), id);

          // A stale id is not selectable; clear the selection (no form-level
          // fallback — that lives in the bottom drawer now).
          if (!node) {
            set({ selectedId: null });
            return;
          }
        }

        set({ selectedId: id });
      },

      setFormConfigOpen: open => set({
        formConfigOpen: open && get().viewMode === "edit"
      }),

      setFormConfigTab: tab => {
        if (get().viewMode !== "edit") {
          return;
        }

        set({ formConfigOpen: true, formConfigTab: tab });
      },

      setViewMode: mode => {
        // A view-mode round trip ends any running property-edit coalescing:
        // edits made before and after it are distinct undo steps.
        coalesceKey = null;

        if (mode !== "edit") {
          // Selection survives the round trip — peeking at the preview or the
          // JSON must not cost the designer their working selection (non-edit
          // surfaces simply don't render it). The config drawer is edit-only
          // chrome, so that one does close.
          set({
            viewMode: mode,
            formConfigOpen: false
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
        set({ device, selectedId: keep });
      },

      initMobile: layer => {
        const { schema } = get();

        checkpoint();
        set({
          schema: withPresentation(schema, "mobile", layer),
          device: "mobile",
          selectedId: null
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
          selectedId: block.id
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

          // The form-level linkage resolves against the PC root scope: prune
          // it when root-scope pc keys moved away (mirrors removeNode).
          if (device === "pc" && nextSchema.linkage !== undefined) {
            const linkage = pruneFormLinkageForRootBucket(nextSchema.linkage, departedKeyBuckets);

            if (linkage !== nextSchema.linkage) {
              nextSchema = { ...nextSchema, linkage };
            }
          }
        }

        // Select the moved node, mirroring insertField / duplicateNode: a drop
        // is a deliberate placement, so the block the designer just positioned
        // stays selected (and the canvas scrolls it into view). The node still
        // resolves — it was moved, not removed — so the id is always live here.
        checkpoint();
        set({ schema: nextSchema, selectedId: nodeId });
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

        // The form-level linkage resolves against the PC root scope: prune it
        // when root-scope pc keys died. Mobile keys never touch it.
        if (device === "pc" && nextSchema.linkage !== undefined) {
          const linkage = pruneFormLinkageForRootBucket(nextSchema.linkage, removedKeyBuckets);

          if (linkage !== nextSchema.linkage) {
            nextSchema = { ...nextSchema, linkage };
          }
        }

        // The removed node may have contained the selection — clear it whenever
        // it no longer resolves in the pruned tree, not only on an exact match.
        const selectionSurvives = selectedId !== null && findNode(nextLayer, selectedId) !== undefined;

        checkpoint();
        set({
          schema: nextSchema,
          selectedId: selectionSurvives ? selectedId : null
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
          selectedId: clone.id
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
        const next = editFieldOp(layer, fieldId, updater);

        // Identity contract: a missing id or an updater that returned its input
        // changes nothing — push no history entry.
        if (next === layer) {
          return;
        }

        checkpointCoalescing(options?.coalesceKey ?? `field:${fieldId}`);
        set({ schema: withPresentation(schema, device, next) });
      },

      setFieldKey: ({ fieldId, key }) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        const field = findField(layer, fieldId);

        if (!field || !isKeyedField(field)) {
          return;
        }

        const scope = findScope(layer, fieldId) ?? [];
        const sanitized = sanitizeKey(key);
        // An all-invalid input sanitizes to empty — keep the current key rather
        // than dropping the field's binding.
        const base = sanitized.length > 0 ? sanitized : field.key;
        // Unique within the scope, excluding the field's own current key so
        // re-typing the same key is a no-op.
        const used = collectScopeKeys(layer, scope);

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

        // The form-level linkage resolves against the PC root scope: a pc
        // root-scope rename must reconcile it too. Mobile keys never touch it.
        if (device === "pc" && scope.length === 0 && nextSchema.linkage !== undefined) {
          const linkage = renameLinkageKeyReferences(nextSchema.linkage, previousKey, unique);

          if (linkage !== nextSchema.linkage) {
            nextSchema = { ...nextSchema, linkage };
          }
        }

        checkpointCoalescing(`field-key:${fieldId}`);
        set({ schema: nextSchema });
      },

      updateBlock: ({ nodeId, updater }, options) => {
        const { device, schema } = get();
        const layer = currentLayer(schema, device);
        const next = updateNodeOp(layer, nodeId, updater);

        if (next === layer) {
          return;
        }

        checkpointCoalescing(options?.coalesceKey ?? `block:${nodeId}`);
        set({ schema: withPresentation(schema, device, next) });
      },

      renameVariable: (name, nextName) => {
        const { schema } = get();
        const variables = schema.variables ?? [];

        if (
          nextName === name
          || !isValidVariableName(nextName)
          || variables.every(variable => variable.name !== name)
          || variables.some(variable => variable.name === nextName)
        ) {
          return;
        }

        checkpoint();
        set({
          schema: {
            ...renameVariableReferences(schema, name, nextName),
            variables: variables.map(variable => variable.name === name ? { ...variable, name: nextName } : variable)
          }
        });
      },

      removeVariable: name => {
        const { schema } = get();
        const variables = schema.variables ?? [];

        if (variables.every(variable => variable.name !== name)) {
          return;
        }

        const remaining = variables.filter(variable => variable.name !== name);
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
          device,
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
          future: [...future, { schema, device }],
          selectedId: keepSelection ? selectedId : null
        });
      },

      redo: () => {
        const {
          device,
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
          past: [...past, { schema, device }],
          future: future.slice(0, -1),
          selectedId: keepSelection ? selectedId : null
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
export function selectFieldCount(state: FormEditorStoreState): number {
  return fieldCountOfLayer(currentLayer(state.schema, state.device));
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
