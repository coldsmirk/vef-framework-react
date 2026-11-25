import type { SchemaIssue } from "../engine/validation";
import type { DataEntryRef, FormEditorStoreApi, PropertiesTabId, SidebarTabId } from "../store/form-store";
import type { Block, FieldLinkage, FormSchema, PresentationDevice, PresentationLayer } from "../types";

import { useCallback } from "react";

import { assertNever } from "../engine/assert-never";
import { isKeyedNode } from "../engine/keys";
import { findNode, nodeLabel, scopeEquals, walkNodes } from "../engine/schema/walk";
import { useFormEditorStoreApi } from "../store/form-store";
import { actionLabelFor } from "./properties/entries/linkage/options";

/**
 * Where a diagnostic can be shown: a node of one device's tree, a specific
 * linkage rule (and optional action step) on a node or on the form, a
 * form-global data source or variable (its edit modal on `数据`), a left-sidebar
 * tab (`data`), or a right-properties tab (`form`).
 */
export type IssueTarget
  = | { kind: "node"; device: PresentationDevice; nodeId: string }
    | { kind: "linkage"; scope: "node"; device: PresentationDevice; nodeId: string; ruleIndex: number; actionIndex?: number }
    | { kind: "linkage"; scope: "form"; ruleIndex: number; actionIndex?: number }
    | { kind: "dataEntry"; entry: DataEntryRef }
    | { kind: "sidebar"; tab: SidebarTabId }
    | { kind: "properties"; tab: PropertiesTabId };

const DEVICES: readonly PresentationDevice[] = ["pc", "mobile"];

/**
 * A body accessor in a presentation path: `children[0]`, `tabs[1]`,
 * `template[2]` — the steps `validateSchema` takes into a container.
 */
const BODY_SEGMENT = /^(?<body>children|tabs|template)\[(?<index>\d+)\]$/;

const NODE_SEGMENT = /^node\[(?<id>[^\]]+)\]$/;

const RULES_SEGMENT = /^rules\[(?<index>\d+)\]$/;

const ACTIONS_SEGMENT = /^actions\[(?<index>\d+)\]$/;

const DATA_SOURCES_HEAD = /^dataSources(?:\[\d+\])?$/;

const VARIABLES_HEAD = /^variables(?:\[\d+\])?$/;

/**
 * Top-level paths that name the schema envelope rather than a field, so a
 * field keyed `id` is never mistaken for the target of an `id_required`.
 */
const ENVELOPE_PATHS: ReadonlySet<string> = new Set(["", "id", "version", "presentations"]);

/**
 * Parse `.rules[r]` (and optional `.actions[a]`) immediately following a
 * `linkage` segment. Returns `undefined` when the path does not name a rule.
 */
function parseLinkageTrail(segments: readonly string[]): {
  ruleIndex: number;
  actionIndex?: number;
  inWhenGuard: boolean;
} | undefined {
  const [ruleSegment, nextSegment, thirdSegment] = segments;

  if (ruleSegment === undefined) {
    return undefined;
  }

  const ruleMatch = RULES_SEGMENT.exec(ruleSegment)?.groups?.index;

  if (ruleMatch === undefined) {
    return undefined;
  }

  const ruleIndex = Number(ruleMatch);
  const actionMatch = nextSegment === undefined ? undefined : ACTIONS_SEGMENT.exec(nextSegment)?.groups?.index;

  return {
    ruleIndex,
    ...actionMatch !== undefined && { actionIndex: Number(actionMatch) },
    inWhenGuard: nextSegment === "trigger" && thirdSegment === "when"
  };
}

/**
 * The block list a `children` / `template` accessor opens on `node`.
 */
function bodyOf(node: Block | undefined, accessor: string): readonly unknown[] | undefined {
  if (node === undefined) {
    return undefined;
  }

  if (accessor === "template") {
    return node.type === "subform" ? node.template : undefined;
  }

  return "children" in node && Array.isArray(node.children) ? node.children : undefined;
}

/**
 * The deepest node a presentation path (`children[0].tabs[1].children[2].key`)
 * reaches. Walking stops at the first segment that is not a body accessor —
 * the property the issue is about.
 */
function nodeIdAtPresentationPath(layer: PresentationLayer, segments: readonly string[]): string | undefined {
  let node: Block | undefined;
  // A list resolved ahead of the index that addresses it: the root's children,
  // or the children of the tab a `tabs[t]` segment just picked.
  let pending: readonly unknown[] | undefined = layer.children;

  for (const segment of segments) {
    const groups = BODY_SEGMENT.exec(segment)?.groups;

    if (groups === undefined) {
      break;
    }

    const index = Number(groups.index);

    if (groups.body === "tabs") {
      pending = node?.type === "tabs" ? node.tabs[index]?.children : undefined;

      if (pending === undefined) {
        break;
      }

      continue;
    }

    const next = (pending ?? bodyOf(node, groups.body ?? ""))?.[index] as Block | undefined;
    pending = undefined;

    if (next === undefined) {
      break;
    }

    node = next;
  }

  return node?.id;
}

/**
 * The node a field-key chain (`amount`, `lines.price`) names: the keyed node
 * whose key is the last link, inside the subform scopes the earlier links
 * name. This is how a host's diagnostics address a field.
 */
function nodeIdByKeyChain(layer: PresentationLayer, chain: readonly string[]): string | undefined {
  const key = chain.at(-1);
  const scope = chain.slice(0, -1);
  let found: string | undefined;

  walkNodes(layer, (node, nodeScope) => {
    if (found === undefined && isKeyedNode(node) && node.key === key && scopeEquals(nodeScope, scope)) {
      found = node.id;
    }
  });

  return found;
}

/**
 * The devices to search, the one on screen first: a diagnostic about a field
 * present in both trees should not flip the designer to the other device.
 */
function devicesByPreference(device: PresentationDevice): PresentationDevice[] {
  return [device, ...DEVICES.filter(candidate => candidate !== device)];
}

function findNodeInDevices(
  schema: FormSchema,
  device: PresentationDevice,
  find: (layer: PresentationLayer) => string | undefined
): { device: PresentationDevice; nodeId: string } | undefined {
  for (const candidate of devicesByPreference(device)) {
    const layer = schema.presentations[candidate];
    const nodeId = layer === undefined ? undefined : find(layer);

    if (nodeId !== undefined) {
      return { device: candidate, nodeId };
    }
  }

  return undefined;
}

/**
 * Resolve a diagnostic's `path` to what the designer should be shown, or
 * `undefined` when it names nothing that can be shown (the schema envelope, a
 * node or key that no longer exists).
 */
export function locateIssue(path: string, schema: FormSchema, device: PresentationDevice): IssueTarget | undefined {
  const segments = path.split(".");
  const [head = "", second] = segments;

  if (head === "presentations" && (second === "pc" || second === "mobile")) {
    const layer = schema.presentations[second];
    const nodeId = layer === undefined ? undefined : nodeIdAtPresentationPath(layer, segments.slice(2));

    return nodeId === undefined
      ? undefined
      : {
          kind: "node",
          device: second,
          nodeId
        };
  }

  const nodeId = NODE_SEGMENT.exec(head)?.groups?.id;

  if (nodeId !== undefined) {
    const found = findNodeInDevices(schema, device, layer => findNode(layer, nodeId)?.id);

    if (found === undefined) {
      return undefined;
    }

    if (second === "linkage") {
      const trail = parseLinkageTrail(segments.slice(2));

      if (trail !== undefined) {
        return {
          kind: "linkage",
          scope: "node",
          device: found.device,
          nodeId: found.nodeId,
          ruleIndex: trail.ruleIndex,
          ...trail.actionIndex !== undefined && { actionIndex: trail.actionIndex }
        };
      }
    }

    return {
      kind: "node",
      device: found.device,
      nodeId: found.nodeId
    };
  }

  if (head === "linkage" || (head === "schema" && second === "linkage")) {
    const trail = parseLinkageTrail(head === "linkage" ? segments.slice(1) : segments.slice(2));

    if (trail !== undefined) {
      return {
        kind: "linkage",
        scope: "form",
        ruleIndex: trail.ruleIndex,
        ...trail.actionIndex !== undefined && { actionIndex: trail.actionIndex }
      };
    }

    return { kind: "properties", tab: "form" };
  }

  if (DATA_SOURCES_HEAD.test(head)) {
    return dataEntryTarget("dataSource", schema.dataSources, head);
  }

  if (VARIABLES_HEAD.test(head)) {
    return dataEntryTarget("variable", schema.variables, head);
  }

  if (ENVELOPE_PATHS.has(path)) {
    return undefined;
  }

  const foundByKey = findNodeInDevices(schema, device, layer => nodeIdByKeyChain(layer, segments));

  return foundByKey === undefined
    ? undefined
    : {
        kind: "node",
        device: foundByKey.device,
        nodeId: foundByKey.nodeId
      };
}

/**
 * The 0-based position an indexed head (`dataSources[2]`) names, or
 * `undefined` for a bare one (`dataSources`).
 */
function headIndex(path: string): number | undefined {
  const index = /^[a-z]+\[(?<index>\d+)\]/i.exec(path)?.groups?.index;

  return index === undefined ? undefined : Number(index);
}

/**
 * The entry a `dataSources[i]` / `variables[i]` path addresses, else the tab
 * that lists them — a path may name the list itself or an entry that is gone.
 */
function dataEntryTarget(
  kind: DataEntryRef["kind"],
  entries: ReadonlyArray<{ id: string }> | undefined,
  head: string
): IssueTarget {
  const index = headIndex(head);
  const id = index === undefined ? undefined : entries?.[index]?.id;

  return id ? { kind: "dataEntry", entry: { kind, id } } : { kind: "sidebar", tab: "data" };
}

/**
 * A named entry of a form-level list — a data source or a variable — by its
 * name, else by its position.
 */
function describeListEntry(noun: string, names: ReadonlyArray<string | undefined>, index: number | undefined): string {
  if (index === undefined) {
    return noun;
  }

  const name = names[index];

  return name !== undefined && name.length > 0 ? `${noun}「${name}」` : `${noun} #${index + 1}`;
}

/**
 * The data source, the variable, or the list of either that a path is about.
 */
function describeDataPath(path: string, schema: FormSchema): string | undefined {
  const [head = ""] = path.split(".");

  if (DATA_SOURCES_HEAD.test(head)) {
    return describeListEntry("数据源", (schema.dataSources ?? []).map(source => source.name), headIndex(path));
  }

  if (VARIABLES_HEAD.test(head)) {
    return describeListEntry("变量", (schema.variables ?? []).map(variable => variable.name), headIndex(path));
  }

  return undefined;
}

function describeLinkageDetail(
  linkage: FieldLinkage | undefined,
  ruleIndex: number,
  actionIndex: number | undefined,
  inWhenGuard: boolean
): string {
  const parts = [`规则 ${ruleIndex + 1}`];

  if (actionIndex !== undefined) {
    const action = linkage?.rules?.[ruleIndex]?.actions[actionIndex];
    const typeLabel = action === undefined ? "" : `（${actionLabelFor(action.type)}）`;

    parts.push(`步骤 ${actionIndex + 1}${typeLabel}`);
  } else if (inWhenGuard) {
    parts.push("执行条件");
  }

  return parts.join(" · ");
}

/**
 * Where a diagnostic is, in the designer's own words — the field it is about
 * (`金额`, `移动端 · 备注`), the exact linkage step (`工号 · 规则 1 · 步骤 3（设置字段）`),
 * or the form-level entry (`数据源「部门」`, `表单事件 · 规则 1 · 步骤 2（选择记录）`)
 * — or `undefined` when the path names nothing the designer shows.
 */
export function describeIssueLocation(path: string, schema: FormSchema, device: PresentationDevice): string | undefined {
  const target = locateIssue(path, schema, device);

  if (target === undefined) {
    return undefined;
  }

  switch (target.kind) {
    case "node": {
      const layer = schema.presentations[target.device];
      const node = layer === undefined ? undefined : findNode(layer, target.nodeId);
      const name = node === undefined ? target.nodeId : nodeLabel(node) ?? (isKeyedNode(node) ? node.key : node.id);

      return target.device === "mobile" ? `移动端 · ${name}` : name;
    }

    case "linkage": {
      const segments = path.split(".");
      const trail = target.scope === "node"
        ? parseLinkageTrail(segments.slice(2))
        : parseLinkageTrail(segments[0] === "linkage" ? segments.slice(1) : segments.slice(2));
      const inWhenGuard = trail?.inWhenGuard === true;

      if (target.scope === "form") {
        return `表单事件 · ${describeLinkageDetail(schema.linkage, target.ruleIndex, target.actionIndex, inWhenGuard)}`;
      }

      const layer = schema.presentations[target.device];
      const node = layer === undefined ? undefined : findNode(layer, target.nodeId);
      const rawName = node === undefined ? target.nodeId : nodeLabel(node) ?? (isKeyedNode(node) ? node.key : node.id);
      const prefix = target.device === "mobile" ? `移动端 · ${rawName}` : rawName;

      return `${prefix} · ${describeLinkageDetail(node?.linkage, target.ruleIndex, target.actionIndex, inWhenGuard)}`;
    }

    case "dataEntry": {
      return describeDataPath(path, schema);
    }

    case "sidebar": {
      return describeDataPath(path, schema);
    }

    case "properties": {
      return target.tab === "form" ? "表单联动" : undefined;
    }

    default: {
      return assertNever(target);
    }
  }
}

function showIssueTarget(storeApi: FormEditorStoreApi, target: IssueTarget): void {
  const state = storeApi.getState();

  switch (target.kind) {
    case "dataEntry": {
      state.requestDataEdit(target.entry);
      return;
    }

    case "sidebar": {
      state.setSidebarTab(target.tab);
      return;
    }

    case "properties": {
      state.setPropertiesTab(target.tab);
      return;
    }

    case "node": {
      if (state.device !== target.device) {
        state.setDevice(target.device);
      }

      state.selectNode(target.nodeId);
      return;
    }

    case "linkage": {
      if (target.scope === "node") {
        if (state.device !== target.device) {
          state.setDevice(target.device);
        }

        storeApi.getState().requestLinkageFocus({
          scope: "node",
          nodeId: target.nodeId,
          ruleIndex: target.ruleIndex,
          ...target.actionIndex !== undefined && { actionIndex: target.actionIndex }
        });
        return;
      }

      state.requestLinkageFocus({
        scope: "form",
        ruleIndex: target.ruleIndex,
        ...target.actionIndex !== undefined && { actionIndex: target.actionIndex }
      });
      return;
    }

    default: {
      assertNever(target);
    }
  }
}

/**
 * Describes a diagnostic's location against the live schema (see
 * {@link describeIssueLocation}). Reads the store when called, so the
 * describer itself is stable.
 */
export function useIssueDescriber(): (issue: SchemaIssue) => string | undefined {
  const storeApi = useFormEditorStoreApi();

  return useCallback(
    (issue: SchemaIssue) => {
      const { device, schema } = storeApi.getState();

      return describeIssueLocation(issue.path, schema, device);
    },
    [storeApi]
  );
}

/**
 * Resolves a diagnostic to the action that shows it — selecting the node it is
 * about (switching device and focusing the exact linkage rule/action when
 * needed; the canvas scrolls a selection into view) or switching the owning
 * side panel to its tab — or `undefined` when it cannot be shown. Reads the
 * store when called, so the resolver itself is stable and never re-renders a
 * list on schema edits.
 */
export function useIssueNavigator(): (issue: SchemaIssue) => (() => void) | undefined {
  const storeApi = useFormEditorStoreApi();

  return useCallback(
    (issue: SchemaIssue) => {
      const { device, schema } = storeApi.getState();
      const target = locateIssue(issue.path, schema, device);

      return target === undefined ? undefined : () => showIssueTarget(storeApi, target);
    },
    [storeApi]
  );
}
