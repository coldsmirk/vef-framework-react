import type { ReactElement, ReactNode } from "react";

import type { FlowEdge, FlowNode } from "../types";

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EditorStoreProvider, useEditorStoreApi } from "./editor";

function seedNodes(): FlowNode[] {
  return [
    {
      id: "start",
      type: "start",
      position: { x: 0, y: 0 },
      deletable: false,
      data: { name: "开始" }
    },
    {
      id: "a1",
      type: "approval",
      position: { x: 200, y: 0 },
      data: { name: "审批" }
    },
    {
      id: "end",
      type: "end",
      position: { x: 400, y: 0 },
      deletable: false,
      data: { name: "结束" }
    }
  ];
}

function seedEdges(): FlowEdge[] {
  return [
    {
      id: "e1",
      source: "start",
      target: "a1"
    },
    {
      id: "e2",
      source: "a1",
      target: "end"
    }
  ];
}

function setup(readonly = false): ReturnType<typeof useEditorStoreApi> {
  function wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <EditorStoreProvider initialState={{
        readonly,
        nodes: seedNodes(),
        edges: seedEdges()
      }}
      >
        {children}
      </EditorStoreProvider>
    );
  }

  return renderHook(() => useEditorStoreApi(), { wrapper }).result.current;
}

/**
 * Wait out the current microtask queue, ending gesture-coalescing runs.
 */
async function nextGesture(): Promise<void> {
  await Promise.resolve();
}

describe("history slice", () => {
  describe("undo / redo", () => {
    it("restores the graph removed by an explicit removeNode and redoes it", () => {
      const api = setup();

      api.getState().removeNode("a1");

      expect(api.getState().nodes.map(n => n.id)).toEqual(["start", "end"]);
      expect(api.getState().edges).toEqual([]);

      api.getState().undo();

      expect(api.getState().nodes.map(n => n.id)).toEqual(["start", "a1", "end"]);
      expect(api.getState().edges.map(e => e.id)).toEqual(["e1", "e2"]);

      api.getState().redo();

      expect(api.getState().nodes.map(n => n.id)).toEqual(["start", "end"]);
    });

    it("bumps changeVersion and marks the flow dirty so the restore reaches onChange", () => {
      const api = setup();

      api.getState().removeEdge("e1");
      const versionAfterEdit = api.getState().changeVersion;

      api.getState().undo();

      expect(api.getState().changeVersion).toBe(versionAfterEdit + 1);
      expect(api.getState().isDirty).toBe(true);
    });

    it("clears a selection that does not survive the restore", () => {
      const api = setup();

      api.getState().addNode("approval", { x: 100, y: 100 });
      const addedId = api.getState().nodes.at(-1)?.id ?? "";
      api.getState().selectNode(addedId);

      api.getState().undo();

      expect(api.getState().nodes.some(n => n.id === addedId)).toBe(false);
      expect(api.getState().selectedNodeId).toBeNull();
    });

    it("ignores undo and redo on a readonly editor", () => {
      const api = setup();
      api.getState().removeEdge("e1");
      api.getState().setReadonly(true);

      api.getState().undo();

      expect(api.getState().edges.some(e => e.id === "e1")).toBe(false);
    });

    it("clears the redo stack on a fresh edit after undo", () => {
      const api = setup();

      api.getState().removeEdge("e1");
      api.getState().undo();
      expect(api.getState().future).toHaveLength(1);

      api.getState().removeEdge("e2");

      expect(api.getState().future).toEqual([]);
    });
  });

  describe("coalescing", () => {
    it("folds consecutive updateNodeData edits to one node into a single undo step", () => {
      const api = setup();

      api.getState().updateNodeData("a1", { name: "审" });
      api.getState().updateNodeData("a1", { name: "审批" });
      api.getState().updateNodeData("a1", { name: "审批人" });

      expect(api.getState().past).toHaveLength(1);

      api.getState().undo();

      const node = api.getState().nodes.find(n => n.id === "a1");
      expect(node?.data.name).toBe("审批");
    });

    it("starts a new step when the selection changes between edit runs", () => {
      const api = setup();

      api.getState().updateNodeData("a1", { name: "first" });
      api.getState().selectNode(null);
      api.getState().updateNodeData("a1", { name: "second" });

      expect(api.getState().past).toHaveLength(2);
    });

    it("folds one delete gesture's node and edge callbacks into a single step", async () => {
      const api = setup();

      // xyflow fires both callbacks synchronously for one Backspace delete:
      // the cascaded edge removals and the node removal must undo together.
      api.getState().onEdgesChange([
        { type: "remove", id: "e1" },
        { type: "remove", id: "e2" }
      ]);
      api.getState().onNodesChange([{ type: "remove", id: "a1" }]);

      expect(api.getState().past).toHaveLength(1);

      await nextGesture();
      api.getState().onEdgesChange([{ type: "remove", id: "missing" }]);

      // The next gesture (after the microtask) is a separate undo step.
      expect(api.getState().past).toHaveLength(2);

      api.getState().undo();
      api.getState().undo();

      expect(api.getState().nodes.map(n => n.id)).toEqual(["start", "a1", "end"]);
      expect(api.getState().edges.map(e => e.id)).toEqual(["e1", "e2"]);
    });

    it("captures a drag once at its first frame and restores the pre-drag position", () => {
      const api = setup();

      api.getState().onNodesChange([
        {
          type: "position",
          id: "a1",
          position: { x: 210, y: 5 },
          dragging: true
        }
      ]);
      api.getState().onNodesChange([
        {
          type: "position",
          id: "a1",
          position: { x: 240, y: 20 },
          dragging: true
        }
      ]);
      api.getState().onNodesChange([
        {
          type: "position",
          id: "a1",
          position: { x: 250, y: 30 },
          dragging: false
        }
      ]);

      expect(api.getState().past).toHaveLength(1);
      expect(api.getState().nodes.find(n => n.id === "a1")?.position).toEqual({ x: 250, y: 30 });

      api.getState().undo();

      expect(api.getState().nodes.find(n => n.id === "a1")?.position).toEqual({ x: 200, y: 0 });
    });

    it("treats a second drag as a separate undo step", () => {
      const api = setup();

      api.getState().onNodesChange([
        {
          type: "position",
          id: "a1",
          position: { x: 240, y: 0 },
          dragging: true
        }
      ]);
      api.getState().onNodesChange([
        {
          type: "position",
          id: "a1",
          position: { x: 250, y: 0 },
          dragging: false
        }
      ]);
      api.getState().onNodesChange([
        {
          type: "position",
          id: "a1",
          position: { x: 300, y: 0 },
          dragging: true
        }
      ]);
      api.getState().onNodesChange([
        {
          type: "position",
          id: "a1",
          position: { x: 310, y: 0 },
          dragging: false
        }
      ]);

      expect(api.getState().past).toHaveLength(2);

      api.getState().undo();

      expect(api.getState().nodes.find(n => n.id === "a1")?.position).toEqual({ x: 250, y: 0 });
    });
  });

  describe("lifecycle", () => {
    it("starts a fresh timeline when a definition loads", () => {
      const api = setup();
      api.getState().removeEdge("e1");

      api.getState().loadDefinition({ nodes: [], edges: [] });

      expect(api.getState().past).toEqual([]);
      expect(api.getState().future).toEqual([]);
    });

    it("trims the oldest entries beyond the history limit", () => {
      const api = setup();

      for (let i = 0; i < 105; i++) {
        api.getState().updateNodeData("a1", { name: `n${i}` });
        // Each edit is its own run — break coalescing like a selection change.
        api.getState().breakCoalescing();
      }

      expect(api.getState().past).toHaveLength(100);
    });
  });
});
