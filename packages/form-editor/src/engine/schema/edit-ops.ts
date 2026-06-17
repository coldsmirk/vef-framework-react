import type {
  Block,
  FieldLinkage,
  FieldLinkageAction,
  FlexSlot,
  LinkageCondition,
  LinkageTrigger,
  PresentationLayer
} from "../../types";
import type { IdPrefix } from "../ids";
import type { ScopePath } from "./walk";

import { cloneDeep, isShallowEqual } from "@vef-framework-react/shared";

import { ROW_COLS } from "../../types";
import { assertNever } from "../assert-never";
import { createId, idPrefixForType } from "../ids";
import { collectScopeKeys, isKeyedNode, nextUniqueKey } from "../keys";
import { removeBlock, updateNode } from "./mutate";
import { containerBodies, mapPreservingIdentity, withContainerBodies } from "./nodes";
import { rewriteContainerBodies } from "./rewrite";
import { containsNode, findNode, findScope, isContainerNode, scopeEquals } from "./walk";

/**
 * Structural edit operations driven by the canvas. Every function is pure and
 * returns a new schema. These compose the primitive tree mutators in
 * `mutate.ts` into the gestures the editor exposes: drop-beside, drop-into-
 * container, append, move, and width.
 *
 * **Identity contract** (shared with `mutate.ts`, part of the public API of
 * every op in this module): an op that changes nothing — a stale anchor, a
 * missing container, a value already in place — returns the **input layer
 * reference unchanged**, and a successful op rebuilds only the path to the
 * mutation, keeping every untouched node and block-list reference identical.
 * The store detects no-ops with `===`; the canvas memoizes blocks by
 * reference.
 */

/**
 * Where a dragged block lands.
 *
 * - `beside` — immediately `before`/`after` the block `anchorId`, sharing its
 * parent list (a sibling in the document stack, or a cell/slot inside a grid /
 * flex). The inserted block auto-sizes (no span).
 * - `container` — appended into a container's body (a tab panel selected by
 * `tabIndex`).
 * - `append` — appended at the end of the form.
 */
export type DropTarget
  = | { kind: "beside"; anchorId: string; side: "before" | "after" }
    | { kind: "container"; containerId: string; tabIndex?: number }
    | { kind: "append" };

/**
 * The id of the node a drop target is anchored to, or `undefined` for a bare
 * append (which has no anchor).
 */
function targetAnchorId(target: DropTarget): string | undefined {
  switch (target.kind) {
    case "beside": {
      return target.anchorId;
    }

    case "container": {
      return target.containerId;
    }

    case "append": {
      return undefined;
    }
  }
}

/**
 * The value {@link ScopePath} a block dropped at `target` will live in. A drop
 * into a subform's body opens that subform's scope; every other target keeps
 * the anchor's scope. Used to allocate per-scope-unique keys.
 */
export function targetScope(schema: PresentationLayer, target: DropTarget): ScopePath {
  if (target.kind === "container") {
    const container = findNode(schema, target.containerId);
    const base = findScope(schema, target.containerId) ?? [];

    return container?.type === "subform" ? [...base, container.key] : base;
  }

  const anchorId = targetAnchorId(target);

  return anchorId === undefined ? [] : findScope(schema, anchorId) ?? [];
}

/**
 * Insert a freshly-created block at a drop target. Returns the input layer
 * unchanged when the target cannot be resolved (a stale anchor id, or a
 * container id that is missing or not a container).
 */
export function insertBlock(schema: PresentationLayer, block: Block, target: DropTarget): PresentationLayer {
  return placeBlock(schema, block, target);
}

/**
 * Move an existing block (field or container) to a drop target. Removes it
 * from its current spot and re-inserts it; a move that crosses value scopes
 * re-keys the moved subtree so its keys stay unique in the destination scope.
 *
 * The move is **transactional**: if the node does not actually land — a stale
 * target id, or a drop nested inside the dragged subtree — it rolls back to the
 * original schema (returning the input layer reference) rather than silently
 * dropping the node.
 */
export function moveBlock(schema: PresentationLayer, nodeId: string, target: DropTarget): PresentationLayer {
  const node = findNode(schema, nodeId);

  if (!node) {
    return schema;
  }

  // Reject a drop onto the dragged node's own anchor or into a zone nested in
  // its own subtree up front: removing it first would delete the very anchor
  // the insert targets.
  const anchorId = targetAnchorId(target);

  if (anchorId !== undefined && containsNode(node, anchorId)) {
    return schema;
  }

  const removed = removeBlock(schema, nodeId);
  // A cross-scope move (e.g. a root field dragged into a subform template) must
  // re-key the moved subtree so its data-binding keys stay unique in the
  // destination scope; otherwise two nodes would bind the same runtime path.
  const currentScope = findScope(schema, nodeId) ?? [];
  const destScope = targetScope(schema, target);
  const placed = scopeEquals(currentScope, destScope)
    ? node
    : rekeyBlock(node, collectScopeKeys(removed, destScope));
  const result = placeBlock(removed, placed, target);

  // Placement is a no-op when the target anchor no longer exists after the
  // removal: a stale id, or an anchor nested inside the dragged subtree (removed
  // with it). Inserting against a vanished anchor would silently drop the node,
  // so roll back to the original schema whenever the move did not land.
  return findNode(result, nodeId) ? result : schema;
}

/**
 * Set (or clear) a block's column span (honored when the block is a grid cell).
 *
 * The span is normalized at the write so the schema only ever persists what
 * `validateSchema` accepts: floored to an integer and clamped into
 * `1..ROW_COLS`; `undefined` (or a non-finite number) clears it back to auto.
 * Writing the value already in place returns the input layer unchanged.
 */
export function setSpan(schema: PresentationLayer, blockId: string, span: number | undefined): PresentationLayer {
  const next = clampSpan(span);

  return updateNode(schema, blockId, block => block.span === next ? block : patchBlock(block, { span: next }));
}

/**
 * Set (or clear) a block's per-slot flex sizing — applied when the block is a
 * direct child of a {@link FlexNode}.
 *
 * The slot is normalized at the write so the schema only ever persists what
 * `validateSchema` accepts: `grow` / `shrink` are clamped to non-negative
 * numbers, non-finite values are dropped. Writing a slot equal to the one
 * already in place returns the input layer unchanged.
 */
export function setFlex(schema: PresentationLayer, blockId: string, flex: FlexSlot | undefined): PresentationLayer {
  const next = clampFlex(flex);

  return updateNode(schema, blockId, block => sameFlex(block.flex, next) ? block : patchBlock(block, { flex: next }));
}

/**
 * Set (or clear) a block's fixed column width (honored when the block is a
 * column of a {@link "../../types"!TableSubform}).
 *
 * The width is normalized at the write so the schema only ever persists what
 * `validateSchema` accepts: floored to an integer and clamped to `>= 1`;
 * `undefined` (or a non-finite number) clears it back to auto. Writing the value
 * already in place returns the input layer unchanged.
 */
export function setColumnWidth(schema: PresentationLayer, blockId: string, width: number | undefined): PresentationLayer {
  const next = clampColumnWidth(width);

  return updateNode(schema, blockId, block => block.columnWidth === next ? block : patchBlock(block, { columnWidth: next }));
}

function clampSpan(span: number | undefined): number | undefined {
  if (span === undefined || !Number.isFinite(span)) {
    return undefined;
  }

  return Math.min(ROW_COLS, Math.max(1, Math.floor(span)));
}

function clampColumnWidth(width: number | undefined): number | undefined {
  if (width === undefined || !Number.isFinite(width)) {
    return undefined;
  }

  return Math.max(1, Math.floor(width));
}

function clampFlex(flex: FlexSlot | undefined): FlexSlot | undefined {
  if (flex === undefined) {
    return undefined;
  }

  const next: FlexSlot = {};

  if (flex.grow !== undefined && Number.isFinite(flex.grow)) {
    next.grow = Math.max(0, flex.grow);
  }

  if (flex.shrink !== undefined && Number.isFinite(flex.shrink)) {
    next.shrink = Math.max(0, flex.shrink);
  }

  if (flex.basis !== undefined) {
    next.basis = flex.basis;
  }

  return next;
}

function sameFlex(a: FlexSlot | undefined, b: FlexSlot | undefined): boolean {
  return a === undefined || b === undefined ? a === b : isShallowEqual(a, b);
}

function placeBlock(schema: PresentationLayer, block: Block, target: DropTarget): PresentationLayer {
  switch (target.kind) {
    case "beside": {
      return insertBeside(schema, target.anchorId, target.side, block);
    }

    case "container": {
      return appendIntoContainer(schema, target.containerId, block, target.tabIndex ?? 0);
    }

    case "append": {
      return { ...schema, children: [...schema.children, block] };
    }
  }
}

/**
 * Insert `block` immediately before/after the block `anchorId`, sharing its
 * parent list — works the same whether the anchor sits in the document stack or
 * in a grid / flex body. Returns the input layer unchanged when the anchor is
 * not in the tree; untouched branches keep their references.
 */
function insertBeside(
  schema: PresentationLayer,
  anchorId: string,
  side: "before" | "after",
  block: Block
): PresentationLayer {
  function rewrite(blocks: Block[]): Block[] {
    const index = blocks.findIndex(child => child.id === anchorId);

    if (index !== -1) {
      const at = side === "before" ? index : index + 1;

      // The inserted block has no span (auto); inside a grid `gridCellStyle`
      // defaults it to a single column, so a sibling's manual width survives.
      return [...blocks.slice(0, at), block, ...blocks.slice(at)];
    }

    return mapPreservingIdentity(blocks, child => rewriteContainerBodies(child, rewrite));
  }

  return withChildren(schema, rewrite(schema.children));
}

/**
 * Append `block` into the container `containerId` (the tab selected by the
 * clamped `tabIndex` for tabs; the single body otherwise). Returns the input
 * layer unchanged when the container is missing (or the id belongs to a
 * non-container); untouched branches keep their references.
 */
function appendIntoContainer(
  schema: PresentationLayer,
  containerId: string,
  block: Block,
  tabIndex: number
): PresentationLayer {
  function rewrite(blocks: Block[]): Block[] {
    return mapPreservingIdentity(blocks, child => rewriteBlock(child));
  }

  function rewriteBlock(node: Block): Block {
    if (node.id === containerId && isContainerNode(node)) {
      const bodies = containerBodies(node);
      // A subform/section has a single body (index 0); tabs append into the
      // selected (clamped) tab.
      const index = node.type === "tabs" ? Math.max(0, Math.min(tabIndex, bodies.length - 1)) : 0;

      return withContainerBodies(node, bodies.map((body, i) => i === index ? [...body, block] : body));
    }

    return rewriteContainerBodies(node, rewrite);
  }

  return withChildren(schema, rewrite(schema.children));
}

/**
 * Rebuild the layer around transformed children, preserving the input layer
 * reference when the children did not change.
 */
function withChildren(schema: PresentationLayer, children: Block[]): PresentationLayer {
  return children === schema.children ? schema : { ...schema, children };
}

/**
 * A key-minting strategy for a tree rebuild (clone or cross-scope move). A
 * function reallocates each keyed node's key in the rebuilt block's own value
 * scope; `null` preserves keys verbatim (used inside a subform template, a
 * self-contained scope whose keys cannot collide with anything outside it).
 */
type KeyPolicy = ((base: string) => string) | null;

/**
 * How a rebuilt node derives its id from the source: {@link freshId} mints a
 * new id (clone); {@link keepId} preserves it (in-place re-key for a move).
 */
type IdPolicy = (prefix: IdPrefix, sourceId: string) => string;

const freshId: IdPolicy = prefix => createId(prefix);
const keepId: IdPolicy = (_prefix, sourceId) => sourceId;

/**
 * Deep-clone a block with fresh node ids throughout. The source tree is
 * deep-copied up front (shared `cloneDeep`), so the clone never shares a
 * nested value object with its source — `validate` rules, `dataSource`
 * options, `flex` sizing, and every linkage payload included. `allocateKey`
 * mints a unique key for every keyed node **in the clone's own value scope**;
 * pass `null` to preserve keys verbatim. A nested subform opens a fresh scope,
 * so its template always recurses with `null` (keys preserved), even when the
 * outer block is reallocating. Linkage rules get fresh ids so the clone and
 * source never share a rule identity, and `leaf.sourceKey` /
 * `set_field.targetKey` references between cloned nodes are remapped to the
 * reallocated keys.
 */
export function cloneBlock(block: Block, allocateKey: KeyPolicy): Block {
  return rekeyTree(cloneDeep(block), allocateKey, freshId);
}

/**
 * Re-key an existing block **in place** (node and linkage-rule ids preserved)
 * so its data-binding keys are unique within `used` — the keys already taken in
 * the value scope it is moving into. Internal `leaf.sourceKey` links follow the
 * new keys. Used by a cross-scope move; cloning uses {@link cloneBlock}, which
 * also mints fresh ids.
 */
function rekeyBlock(block: Block, used: Set<string>): Block {
  return rekeyTree(block, base => nextUniqueKey(used, base), keepId);
}

/**
 * Two-phase tree rebuild shared by clone and cross-scope move. Phase 1 rebuilds
 * the structure — ids via `idPolicy`, keys via `allocateKey` — recording every
 * old→new key reallocation in the block's own value scope. Phase 2 rewrites
 * linkage `leaf.sourceKey` references so links between the rebuilt nodes follow
 * the new keys. A nested subform opens a fresh scope, so its template keeps its
 * keys and inner links verbatim and the rewrite stops at that boundary.
 */
function rekeyTree(block: Block, allocateKey: KeyPolicy, idPolicy: IdPolicy): Block {
  if (allocateKey === null) {
    return rebuildBlock(block, null, idPolicy);
  }

  const keyMap = new Map<string, string>();

  const recordKey = (base: string): string => {
    const next = allocateKey(base);

    keyMap.set(base, next);

    return next;
  };

  const rebuilt = rebuildBlock(block, recordKey, idPolicy);

  return keyMap.size === 0 ? rebuilt : remapScopeLinkage(rebuilt, keyMap);
}

function rebuildBlock(block: Block, allocateKey: KeyPolicy, idPolicy: IdPolicy): Block {
  const id = idPolicy(idPrefixForType(block.type), block.id);
  const linkage = rebuildLinkage(block.linkage, idPolicy);

  if (!isContainerNode(block)) {
    if (isKeyedNode(block)) {
      return {
        ...block,
        id,
        key: allocateKey ? allocateKey(block.key) : block.key,
        linkage
      };
    }

    return {
      ...block,
      id,
      linkage
    };
  }

  switch (block.type) {
    case "section": {
      return {
        ...block,
        id,
        linkage,
        children: rebuildBlocks(block.children, allocateKey, idPolicy)
      };
    }

    case "tabs": {
      return {
        ...block,
        id,
        linkage,
        tabs: block.tabs.map(tab => {
          return {
            ...tab,
            id: idPolicy("Tab", tab.id),
            children: rebuildBlocks(tab.children, allocateKey, idPolicy)
          };
        })
      };
    }

    case "subform": {
      return {
        ...block,
        id,
        key: allocateKey ? allocateKey(block.key) : block.key,
        linkage,
        // The template opens a fresh value scope: its keys are preserved.
        template: rebuildBlocks(block.template, null, idPolicy)
      };
    }

    case "flex": {
      return {
        ...block,
        id,
        linkage,
        children: rebuildBlocks(block.children, allocateKey, idPolicy)
      };
    }

    case "grid": {
      return {
        ...block,
        id,
        linkage,
        children: rebuildBlocks(block.children, allocateKey, idPolicy)
      };
    }

    default: {
      return assertNever(block);
    }
  }
}

function rebuildBlocks(blocks: Block[], allocateKey: KeyPolicy, idPolicy: IdPolicy): Block[] {
  return blocks.map(block => rebuildBlock(block, allocateKey, idPolicy));
}

/**
 * Phase 2 of {@link rekeyTree}: rewrite linkage `leaf.sourceKey` in the block's
 * own value scope via `keyMap` (old→new). Scope-aware — a nested subform
 * template is a separate key namespace, so the rewrite does not descend into it
 * (a key name that merely coincides there must not be remapped). Expression and
 * script sources are opaque host code and are left untouched.
 */
function remapScopeLinkage(block: Block, keyMap: Map<string, string>): Block {
  const linkage = remapLinkage(block.linkage, keyMap);

  if (!isContainerNode(block)) {
    return { ...block, linkage };
  }

  switch (block.type) {
    case "section": {
      return {
        ...block,
        linkage,
        children: remapScopeBlocks(block.children, keyMap)
      };
    }

    case "tabs": {
      return {
        ...block,
        linkage,
        tabs: block.tabs.map(tab => {
          return { ...tab, children: remapScopeBlocks(tab.children, keyMap) };
        })
      };
    }

    case "subform": {
      // The template is a separate scope; only the subform's own linkage (which
      // references outer-scope siblings) is remapped here.
      return { ...block, linkage };
    }

    case "flex": {
      return {
        ...block,
        linkage,
        children: remapScopeBlocks(block.children, keyMap)
      };
    }

    case "grid": {
      return {
        ...block,
        linkage,
        children: remapScopeBlocks(block.children, keyMap)
      };
    }

    default: {
      return assertNever(block);
    }
  }
}

function remapScopeBlocks(blocks: Block[], keyMap: Map<string, string>): Block[] {
  return blocks.map(block => remapScopeLinkage(block, keyMap));
}

function remapLinkage(linkage: FieldLinkage | undefined, keyMap: Map<string, string>): FieldLinkage | undefined {
  if (!linkage?.rules) {
    return linkage;
  }

  return {
    ...linkage,
    rules: linkage.rules.map(rule => {
      return {
        ...rule,
        trigger: remapTriggerKeys(rule.trigger, keyMap),
        actions: rule.actions.map(action => remapActionKeys(action, keyMap))
      };
    })
  };
}

function remapTriggerKeys(trigger: LinkageTrigger, keyMap: Map<string, string>): LinkageTrigger {
  return trigger.kind === "condition"
    ? { ...trigger, condition: remapConditionKeys(trigger.condition, keyMap) }
    : trigger;
}

/**
 * A `set_field` effect references a sibling field's key; a cross-scope move
 * re-keys it just like a condition source. Other actions carry no field key.
 */
function remapActionKeys(action: FieldLinkageAction, keyMap: Map<string, string>): FieldLinkageAction {
  if (action.type !== "set_field") {
    return action;
  }

  const mapped = keyMap.get(action.targetKey);

  return mapped === undefined ? action : { ...action, targetKey: mapped };
}

function remapConditionKeys(condition: LinkageCondition, keyMap: Map<string, string>): LinkageCondition {
  if (condition.kind === "group") {
    return { ...condition, children: condition.children.map(child => remapConditionKeys(child, keyMap)) };
  }

  if (condition.kind === "leaf") {
    const mapped = keyMap.get(condition.sourceKey);

    return mapped === undefined ? condition : { ...condition, sourceKey: mapped };
  }

  return condition;
}

/**
 * Rebuild a node's linkage rule ids under the tree's {@link IdPolicy}: a clone
 * mints fresh ids (so it never shares a rule identity with its source), while a
 * move keeps them (the rule is the same instance, only relocated). No payload
 * copying happens here — {@link cloneBlock} deep-clones the whole tree up
 * front, so every nested trigger / condition / action object is already
 * exclusively owned by the rebuilt tree.
 */
function rebuildLinkage(linkage: FieldLinkage | undefined, idPolicy: IdPolicy): FieldLinkage | undefined {
  if (!linkage?.rules) {
    return linkage;
  }

  return {
    ...linkage,
    rules: linkage.rules.map(rule => {
      return { ...rule, id: idPolicy("Rule", rule.id) };
    })
  };
}

/**
 * Immutably patch a block, preserving its concrete kind. Localizes the single
 * unavoidable spread-widening assertion (spreading a discriminated union loses
 * the discriminant) to one place.
 */
function patchBlock<T extends Block>(block: T, patch: Partial<T>): T {
  return { ...block, ...patch } as T;
}
