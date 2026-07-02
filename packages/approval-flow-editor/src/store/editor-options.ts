import type { ConnectionContext, EditorOptions, EditorState, FlowNode } from "@coldsmirk/nodeloom-core";

import type { ConnectionRejection } from "../shared/connection-rules";
import type { FlowDefinition } from "../types";

import { explainConnectionRejection } from "../shared/connection-rules";
import { toFlowDefinition } from "../shared/serialization";
import { nodeConfig } from "./config-access";

/**
 * Human-readable hints for refused connection attempts — a silently dropped
 * edge looks like a bug, not a rule. Carried as the verdict's `reason`, so the
 * engine surfaces them through `onInvalidConnection` on a rejected drop.
 */
export const REJECTION_MESSAGES: Record<ConnectionRejection, string> = {
  self: "不能连接节点自身",
  occupied: "该出口已有连线，请先删除原有连线",
  cycle: "无法连接：会形成循环流转"
};

/**
 * Drop rollback-target references that point at removed nodes, so the serialized definition never
 * carries dangling keys. Runs from `onElementsDeleted`, which covers BOTH deletion paths (the
 * imperative actions and canvas-native Backspace) inside the deletion's atomic boundary — the
 * pruning joins the deletion's undo step and its onChange emission.
 */
function pruneRollbackTargetRefs(deletedNodes: FlowNode[], state: EditorState): void {
  if (deletedNodes.length === 0) {
    return;
  }

  const removedIds = new Set(deletedNodes.map(node => node.id));

  for (const node of state.nodes) {
    const config = nodeConfig(node, "approval");
    const keys = config?.rollbackTargetKeys;

    if (!keys?.length) {
      continue;
    }

    const pruned = keys.filter(key => !removedIds.has(key));

    if (pruned.length !== keys.length) {
      state.updateNodeConfig(node.id, { rollbackTargetKeys: pruned });
    }
  }
}

export interface BuildEditorOptionsInput {
  readonly: boolean;
  /**
   * Receives the serialized definition after every persistence-worthy edit (the engine's
   * `onChange`, mapped to the wire format).
   */
  onDefinitionChange?: (definition: FlowDefinition) => void;
  /**
   * Receives the human-readable reason when an interactive connection attempt is refused.
   */
  onConnectionRejected?: (reason: string) => void;
}

/**
 * The approval editor's engine configuration: the flow-direction rules (no self-loops, one edge
 * per source handle, no cycles) as the global connection rule, dangling-reference pruning on
 * every deletion path, the readonly gate, and the wire-format onChange bridge. Built per render
 * and read lazily by the engine, so prop changes take effect without recreating the store.
 */
export function buildEditorOptions(input: BuildEditorOptionsInput): EditorOptions {
  return {
    readonly: input.readonly,

    validateConnection: (ctx: ConnectionContext) => {
      const rejection = explainConnectionRejection(
        {
          source: ctx.source.id,
          target: ctx.target.id,
          sourceHandle: ctx.sourceHandle
        },
        ctx.edges
      );

      return rejection === null ? true : { ok: false, reason: REJECTION_MESSAGES[rejection] };
    },

    onInvalidConnection: (_ctx, reason) => {
      if (reason) {
        input.onConnectionRejected?.(reason);
      }
    },

    onElementsDeleted: (deleted, state) => {
      pruneRollbackTargetRefs(deleted.nodes, state);
    },

    onChange: graph => {
      input.onDefinitionChange?.(toFlowDefinition(graph.nodes, graph.edges));
    }
  };
}
