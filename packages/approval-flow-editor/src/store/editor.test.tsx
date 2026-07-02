import type { EditorOptions, EditorStore } from "@coldsmirk/nodeloom-core";
import type { ReactNode } from "react";

import type { FlowDefinition } from "../types";
import type { ApprovalActions } from "./approval-actions";

import { NodeloomProvider, useEditorStoreApi } from "@coldsmirk/nodeloom-core";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createSeedFlow } from "../shared/seed-flow";
import { fromFlowDefinition } from "../shared/serialization";
import { useApprovalActions } from "./approval-actions";
import { nodeConfig } from "./config-access";
import { buildEditorOptions } from "./editor-options";
import { engineNodeRegistry } from "./engine-specs";

/**
 * Resolve the trailing microtask the engine uses to coalesce history commits.
 */
function flush() {
  return new Promise<void>(resolve => {
    queueMicrotask(resolve);
  });
}

function mountEditor(input?: { definition?: FlowDefinition; options?: Partial<Parameters<typeof buildEditorOptions>[0]> }) {
  const emitted: FlowDefinition[] = [];
  const options: EditorOptions = buildEditorOptions({
    readonly: false,
    onDefinitionChange: definition => {
      emitted.push(definition);
    },
    ...input?.options
  });
  const graph = input?.definition ? fromFlowDefinition(input.definition) : createSeedFlow();

  function wrapper(props: { children: ReactNode }) {
    return (
      <NodeloomProvider defaultValue={graph} nodeRegistry={engineNodeRegistry} options={options}>
        {props.children}
      </NodeloomProvider>
    );
  }

  const { result } = renderHook(
    () => {
      return { store: useEditorStoreApi(), actions: useApprovalActions() };
    },
    { wrapper }
  );

  return {
    emitted,
    store: result.current.store as EditorStore,
    actions: result.current.actions as ApprovalActions
  };
}

const conditionDefinition: FlowDefinition = {
  nodes: [
    {
      id: "start_1",
      kind: "start",
      position: { x: 0, y: 0 }
    },
    {
      id: "condition_1",
      kind: "condition",
      position: { x: 200, y: 0 },
      data: {
        name: "条件",
        branches: [
          {
            id: "branch_a",
            label: "A",
            priority: 1
          },
          {
            id: "branch_default",
            label: "默认",
            isDefault: true,
            priority: 99
          }
        ]
      }
    },
    {
      id: "end_1",
      kind: "end",
      position: { x: 400, y: 0 }
    }
  ],
  edges: [
    {
      id: "e_start",
      source: "start_1",
      target: "condition_1"
    },
    {
      id: "e_branch",
      source: "condition_1",
      sourceHandle: "branch_a",
      target: "end_1"
    }
  ]
};

describe("editor engine wiring", () => {
  it("addNode stamps the kind-prefixed id, selects the node, and one undo removes it", async () => {
    const { store, actions } = mountEditor();

    const id = actions.addNode("approval", { x: 100, y: 100 });

    expect(id).toMatch(/^approval_/);
    expect(store.getState().selectedNodeId).toBe(id);
    expect(store.getState().nodes).toHaveLength(3);

    await flush();
    store.getState().undo();

    expect(store.getState().nodes).toHaveLength(2);
  });

  it("refuses a second start node (maxCount) and reports refusal via null", () => {
    const { store, actions } = mountEditor();

    const id = actions.addNode("start", { x: 50, y: 50 });

    expect(id).toBeNull();
    expect(store.getState().nodes.filter(n => n.data.kind === "start")).toHaveLength(1);
  });

  it("folds a keystroke run on one node into a single undo step", async () => {
    const { store, actions } = mountEditor();
    const id = actions.addNode("approval", { x: 0, y: 120 });

    await flush();

    actions.updateNodeData(id ?? "", { name: "审" });
    await flush();
    actions.updateNodeData(id ?? "", { name: "审批" });
    await flush();
    actions.updateNodeData(id ?? "", { name: "审批人" });
    await flush();

    store.getState().undo();

    const node = store.getState().nodes.find(n => n.id === id);

    expect(nodeConfig(node, "approval")?.name).toBe("审批节点");
  });

  it("removes a condition branch together with its edges in ONE atomic undo step", async () => {
    const { store, actions } = mountEditor({ definition: conditionDefinition });

    actions.removeConditionBranch("condition_1", "branch_a");
    await flush();

    const afterRemove = store.getState();

    expect(nodeConfig(afterRemove.nodes.find(n => n.id === "condition_1"), "condition")?.branches).toHaveLength(1);
    expect(afterRemove.edges.some(e => e.id === "e_branch")).toBe(false);

    // One undo restores the branch AND its edge together — the transact boundary.
    store.getState().undo();

    const restored = store.getState();

    expect(nodeConfig(restored.nodes.find(n => n.id === "condition_1"), "condition")?.branches).toHaveLength(2);
    expect(restored.edges.some(e => e.id === "e_branch")).toBe(true);
    expect(restored.canUndo).toBe(false);
  });

  it("prunes rollbackTargetKeys referencing a deleted node, canvas path included, in one undo step", async () => {
    const { store, actions } = mountEditor();
    const targetId = actions.addNode("handle", { x: 0, y: 150 });
    const approvalId = actions.addNode("approval", { x: 0, y: 300 }, {
      rollbackType: "specified",
      rollbackTargetKeys: [targetId ?? ""]
    });

    await flush();

    // Canvas-native removal (Backspace) dispatches remove changes — the hook must cover it.
    store.getState().onNodesChange([{ type: "remove", id: targetId ?? "" }]);
    await flush();

    const pruned = store.getState();

    expect(pruned.nodes.some(n => n.id === targetId)).toBe(false);
    expect(nodeConfig(pruned.nodes.find(n => n.id === approvalId), "approval")?.rollbackTargetKeys).toEqual([]);

    // One undo restores the node and the reference together — the deletion's atomic boundary.
    store.getState().undo();

    const restored = store.getState();

    expect(restored.nodes.some(n => n.id === targetId)).toBe(true);
    expect(nodeConfig(restored.nodes.find(n => n.id === approvalId), "approval")?.rollbackTargetKeys).toEqual([targetId]);
  });

  it("refuses every mutation under readonly", () => {
    const { store, actions } = mountEditor({ options: { readonly: true } });
    const before = store.getState().nodes;

    expect(actions.addNode("approval", { x: 0, y: 0 })).toBeNull();
    actions.updateNodeData(before[0]?.id ?? "", { name: "changed" });
    actions.removeNode(before[0]?.id ?? "");

    expect(store.getState().nodes).toEqual(before);
  });

  it("starts a fresh history on a programmatic reload", async () => {
    const { store, actions } = mountEditor();

    actions.addNode("approval", { x: 0, y: 100 });
    await flush();
    store.getState().setGraph(fromFlowDefinition(conditionDefinition));

    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().nodes).toHaveLength(3);
  });

  it("emits the wire definition (config flattened to data) after an edit, not on selection", () => {
    const {
      store,
      actions,
      emitted
    } = mountEditor();

    store.getState().selectNode(store.getState().nodes[0]?.id ?? null);
    expect(emitted).toHaveLength(0);

    const id = actions.addNode("approval", { x: 10, y: 10 });

    expect(emitted).toHaveLength(1);
    const definition = emitted[0];
    const wireNode = definition?.nodes.find(n => n.id === id);

    expect(wireNode?.kind).toBe("approval");
    // Business fields ride the wire `data` directly — the engine's config wrapper never leaks.
    expect(wireNode?.data).toMatchObject({ name: "审批节点", executionType: "manual" });
    expect(wireNode?.data && "config" in wireNode.data).toBe(false);
  });
});
