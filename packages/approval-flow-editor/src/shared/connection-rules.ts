import type { Connection, Edge } from "@xyflow/react";

import type { FlowEdge } from "../types";

/**
 * Check if adding an edge from source to target would create a cycle.
 * Traverses from target following existing outgoing edges — if we can reach source, it's a cycle.
 */
function wouldCreateCycle(source: string, target: string, edges: FlowEdge[]): boolean {
  const visited = new Set<string>();
  const stack = [target];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (current === source) {
      return true;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    for (const edge of edges) {
      if (edge.source === current) {
        stack.push(edge.target);
      }
    }
  }

  return false;
}

/**
 * Why a connection attempt was refused — the UI maps each reason to a
 * human-readable hint, so a rejected drag never fails silently.
 */
export type ConnectionRejection = "self" | "occupied" | "cycle";

/**
 * Explain why connecting source → target would be rejected, or null when the
 * connection is allowed. Expects both endpoints to be present (xyflow only
 * completes a connection attempt on a concrete handle).
 *
 * Rules:
 * 1. No self-loops
 * 2. Each source handle allows only one outgoing edge
 * 3. No cycles (DAG constraint)
 */
export function explainConnectionRejection(
  connection: Pick<Edge | Connection, "source" | "target" | "sourceHandle">,
  edges: FlowEdge[]
): ConnectionRejection | null {
  const { source, target } = connection;
  const sourceHandle = connection.sourceHandle ?? null;

  if (source === target) {
    return "self";
  }

  const hasOutgoing = edges.some(
    e => e.source === source && (e.sourceHandle ?? null) === sourceHandle
  );

  if (hasOutgoing) {
    return "occupied";
  }

  if (wouldCreateCycle(source, target, edges)) {
    return "cycle";
  }

  return null;
}

/**
 * Pure validation function: checks whether a connection is allowed. Boolean
 * facade over {@link explainConnectionRejection} for xyflow's isValidConnection.
 */
export function validateConnection(connection: Edge | Connection, edges: FlowEdge[]): boolean {
  if (!connection.source || !connection.target) {
    return false;
  }

  return explainConnectionRejection(connection, edges) === null;
}
