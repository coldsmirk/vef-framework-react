import type { NodeKind } from "@vef-framework-react/approval-flow-editor";

import type { UserInfo } from "./base";
import type { ActivityAction, NodeProgressStatus, NodeVisitStatus } from "./enums";

/**
 * One assignee's involvement at an approval/handle node during a single
 * visit, mirroring the Go `approval.NodeParticipant`. `taskId` is what task
 * operations are submitted against; outcome details are fused from the action
 * log that finished the task.
 */
export interface NodeParticipant {
  taskId: string;
  user: UserInfo;
  delegator?: UserInfo;
  status: string;
  deadline?: string;
  isTimeout?: boolean;
  opinion?: string;
  attachments?: string[];
  actionTime?: string;
  transferTo?: UserInfo;
}

/**
 * A side action recorded at a node, mirroring the Go `approval.Activity`.
 * Decisions themselves (approve / handle / reject) are not repeated here —
 * they live on the participant that made them.
 */
export interface Activity {
  action: ActivityAction;
  operator: UserInfo;
  opinion?: string;
  attachments?: string[];
  transferTo?: UserInfo;
  target?: UserInfo;
  rollbackToNodeId?: string;
  rollbackToNodeName?: string;
  addedAssignees?: UserInfo[];
  removedAssignees?: UserInfo[];
  ccUsers?: UserInfo[];
  createdAt: string;
}

/**
 * One carbon-copy recipient at a node, with the read receipt when confirmed.
 */
export interface CCRecipient {
  user: UserInfo;
  readAt?: string;
}

/**
 * Kind of an instance timeline entry: node entries plus the withdraw /
 * terminate milestones.
 */
export type TimelineEntryKind = "start" | "approval" | "handle" | "cc" | "withdraw" | "terminate";

/**
 * One step of the instance timeline — the chronological, node-by-node account
 * of the path an instance actually took, mirroring `approval.TimelineEntry`.
 * Entries end at the node currently in progress; unreached nodes are not
 * predicted.
 */
export interface TimelineEntry {
  kind: TimelineEntryKind;
  nodeId?: string;
  name?: string;
  status?: NodeVisitStatus;
  executionType?: string;
  approvalMethod?: string;
  passRule?: string;
  /**
   * Percentage in `(0, 100]`, serialized as a decimal string.
   */
  passRatio?: string;
  participants?: NodeParticipant[];
  ccRecipients?: CCRecipient[];
  activities?: Activity[];
  startedAt: string;
  finishedAt?: string;
}

/**
 * A React Flow–ready node of the instance flow graph. `kind` selects the node
 * renderer (React Flow's `type`); `data` carries the progress-annotated
 * payload.
 */
export interface FlowGraphNode {
  id: string;
  nodeId: string;
  kind: NodeKind;
  position: { x: number; y: number };
  data: FlowGraphNodeData;
}

/**
 * The runtime payload of a flow-graph node: display config plus progress and
 * the same participant / CC / activity shapes the timeline uses, aggregated
 * across the node's visits in traversal order.
 */
export interface FlowGraphNodeData {
  name: string;
  status: NodeProgressStatus;
  executionType?: string;
  approvalMethod?: string;
  passRule?: string;
  /**
   * Percentage in `(0, 100]`, serialized as a decimal string.
   */
  passRatio?: string;
  participants?: NodeParticipant[];
  ccRecipients?: CCRecipient[];
  activities?: Activity[];
  startedAt?: string;
  finishedAt?: string;
}

/**
 * A React Flow–ready edge of the instance flow graph.
 */
export interface FlowGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

/**
 * The read-only, progress-annotated projection of an instance's flow
 * definition, mirroring `approval.InstanceFlowGraph`.
 */
export interface InstanceFlowGraph {
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
}
