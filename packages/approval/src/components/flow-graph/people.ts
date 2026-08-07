import type { Activity, CCRecipient, FlowGraphNodeData, NodeParticipant, TaskStatus, UserInfo } from "../../types";

/**
 * One person rendered above a flow-graph node, discriminated by what they are
 * to that node. Each variant keeps its source record whole so the hover card
 * can show that role's own detail — a participant's decision and opinion, a CC
 * recipient's read receipt, an operator's action — rather than a lowest common
 * denominator.
 *
 * `user` is hoisted onto every variant because the avatar itself only ever
 * needs the person; only the hover card switches on `kind`.
 */
export type NodePerson
  = | { kind: "participant"; key: string; user: UserInfo; participant: NodeParticipant }
    | { kind: "cc"; key: string; user: UserInfo; recipient: CCRecipient }
    | { kind: "operator"; key: string; user: UserInfo; activity: Activity };

/**
 * How a person's own outcome tints their avatar ring. Deliberately the same
 * five-way semantic system the status tags use (blue = in motion, green =
 * positive, red = negative, orange = sent back, gray = inert) so one glance
 * reads the same everywhere.
 */
export type PersonTone = "processing" | "success" | "error" | "warning" | "default";

/**
 * Tone per task status. Total over the union so a new backend status is a type
 * error here rather than a silently gray avatar.
 */
const PARTICIPANT_TONES: Record<TaskStatus, PersonTone> = {
  waiting: "default",
  pending: "processing",
  approved: "success",
  rejected: "error",
  handled: "success",
  transferred: "processing",
  rolled_back: "warning",
  canceled: "default",
  removed: "default",
  skipped: "default"
};

/**
 * The ring tone for one person. An unrecognized participant status (the field
 * arrives untyped) falls back to neutral rather than guessing an outcome.
 */
export function personTone(person: NodePerson): PersonTone {
  switch (person.kind) {
    case "participant": {
      return PARTICIPANT_TONES[person.participant.status as TaskStatus] ?? "default";
    }

    case "cc": {
      return person.recipient.readAt ? "success" : "default";
    }

    case "operator": {
      // Every recorded activity is an act already completed.
      return "success";
    }
  }
}

/**
 * The people to float above a node, in the order the backend recorded them.
 *
 * Exactly one source is used per node, in precedence order, so nobody is drawn
 * twice: assignees if the node opened tasks, else CC recipients if it only
 * notified, else the operators of whatever was recorded there — which is what
 * puts the submitter above the start node, since a submit is an activity and
 * never a task.
 *
 * Activity operators are deduplicated by user and keep their first act. A
 * person who acted several times at one node is one avatar, not several; the
 * timeline is where the full account lives — the graph stays a map.
 */
export function collectNodePeople(data: FlowGraphNodeData): NodePerson[] {
  const participants = data.participants ?? [];

  if (participants.length > 0) {
    return participants.map(participant => {
      return {
        kind: "participant",
        key: participant.taskId,
        user: participant.user,
        participant
      };
    });
  }

  const ccRecipients = data.ccRecipients ?? [];

  if (ccRecipients.length > 0) {
    return ccRecipients.map(recipient => {
      return {
        kind: "cc",
        key: recipient.user.id,
        user: recipient.user,
        recipient
      };
    });
  }

  const activities = data.activities ?? [];
  const seen = new Set<string>();
  const operators: NodePerson[] = [];

  for (const activity of activities) {
    if (seen.has(activity.operator.id)) {
      continue;
    }

    seen.add(activity.operator.id);
    operators.push({
      kind: "operator",
      key: activity.operator.id,
      user: activity.operator,
      activity
    });
  }

  return operators;
}
