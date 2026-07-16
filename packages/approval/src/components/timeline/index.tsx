import type { TimelineItem } from "@vef-framework-react/components";

import type { Activity, CCRecipient, NodeParticipant, NodeVisitStatus, TimelineEntry } from "../../types";

import { Empty, Flex, globalCssVars, Stack, Tag, Text, Timeline, Tooltip } from "@vef-framework-react/components";

import { formatTimestamp } from "../format";
import { TaskStatusTag } from "../status";
import { ACTIVITY_ACTION_LABELS } from "../status/labels";
import { UserLabel } from "../user";

const VISIT_STATUS_DOT_COLORS: Record<NodeVisitStatus, string> = {
  active: "blue",
  passed: "green",
  rejected: "red",
  returned: "orange",
  canceled: "gray"
};

/**
 * The free-text of a decision or side action, set off as a quiet quote block
 * so opinions read as spoken words rather than metadata.
 */
function OpinionQuote({ opinion }: { opinion: string }) {
  return (
    <div
      style={{
        padding: "4px 10px",
        borderInlineStart: `3px solid ${globalCssVars.colorBorder}`,
        background: globalCssVars.colorFillQuaternary,
        borderRadius: 4
      }}
    >
      <Text style={{ fontSize: globalCssVars.fontSizeSm, whiteSpace: "pre-wrap" }}>{opinion}</Text>
    </div>
  );
}

function ParticipantRow({ participant }: { participant: NodeParticipant }) {
  return (
    <Stack gap={4}>
      <Flex align="center" gap="small" wrap="wrap">
        <UserLabel user={participant.user} />

        {participant.delegator && (
          <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
            {`（受 ${participant.delegator.name || participant.delegator.id} 委托）`}
          </Text>
        )}

        <TaskStatusTag status={participant.status} />
        {participant.isTimeout && <Tag color="error">已超时</Tag>}

        {participant.transferTo && (
          <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
            {`转办给 ${participant.transferTo.name || participant.transferTo.id}`}
          </Text>
        )}

        {participant.actionTime && (
          <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
            {formatTimestamp(participant.actionTime)}
          </Text>
        )}
      </Flex>

      {participant.opinion && <OpinionQuote opinion={participant.opinion} />}
    </Stack>
  );
}

function describeActivity(activity: Activity): string {
  const label = ACTIVITY_ACTION_LABELS[activity.action];
  const parts: string[] = [label];

  if (activity.transferTo) {
    parts.push(`给 ${activity.transferTo.name || activity.transferTo.id}`);
  }

  if (activity.target) {
    parts.push(`（${activity.target.name || activity.target.id}）`);
  }

  if (activity.rollbackToNodeName) {
    parts.push(`至「${activity.rollbackToNodeName}」`);
  }

  const people = [
    ...activity.addedAssignees ?? [],
    ...activity.removedAssignees ?? [],
    ...activity.ccUsers ?? []
  ];

  if (people.length > 0) {
    parts.push(people.map(user => user.name || user.id).join("、"));
  }

  return parts.join(" ");
}

function ActivityRow({ activity }: { activity: Activity }) {
  return (
    <Stack gap={4}>
      <Flex align="center" gap="small" wrap="wrap">
        <UserLabel avatarSize={18} user={activity.operator} />
        <Text style={{ fontSize: globalCssVars.fontSizeSm }}>{describeActivity(activity)}</Text>

        <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
          {formatTimestamp(activity.createdAt)}
        </Text>
      </Flex>

      {activity.opinion && <OpinionQuote opinion={activity.opinion} />}
    </Stack>
  );
}

function CCRecipientsRow({ recipients }: { recipients: CCRecipient[] }) {
  const readCount = recipients.filter(recipient => recipient.readAt).length;

  return (
    <Flex align="center" gap="small" wrap="wrap">
      <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">抄送</Text>

      {recipients.map(recipient => (
        <Tooltip
          key={recipient.user.id}
          title={recipient.readAt ? `已读 ${formatTimestamp(recipient.readAt)}` : "未读"}
        >
          <Tag color={recipient.readAt ? "success" : "default"} style={{ marginInlineEnd: 0 }}>
            {recipient.user.name || recipient.user.id}
          </Tag>
        </Tooltip>
      ))}

      <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
        {`已读 ${readCount}/${recipients.length}`}
      </Text>
    </Flex>
  );
}

function entryDotColor(entry: TimelineEntry): string {
  if (entry.kind === "withdraw") {
    return "gray";
  }

  if (entry.kind === "terminate") {
    return "red";
  }

  return entry.status ? VISIT_STATUS_DOT_COLORS[entry.status] : "gray";
}

function entryTitle(entry: TimelineEntry): string {
  if (entry.kind === "withdraw") {
    return "撤回";
  }

  if (entry.kind === "terminate") {
    return "终止";
  }

  return entry.name ?? "";
}

function EntryHeader({ entry }: { entry: TimelineEntry }) {
  return (
    <Flex align="center" gap="small" wrap="wrap">
      <Text strong>{entryTitle(entry)}</Text>

      <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
        {formatTimestamp(entry.startedAt)}
        {entry.finishedAt ? ` → ${formatTimestamp(entry.finishedAt)}` : ""}
      </Text>
    </Flex>
  );
}

function EntryBody({ entry }: { entry: TimelineEntry }) {
  const participants = entry.participants ?? [];
  const activities = entry.activities ?? [];
  const ccRecipients = entry.ccRecipients ?? [];

  if (participants.length === 0 && activities.length === 0 && ccRecipients.length === 0) {
    return null;
  }

  return (
    <Stack gap={8}>
      {participants.map(participant => <ParticipantRow key={participant.taskId} participant={participant} />)}
      {ccRecipients.length > 0 && <CCRecipientsRow recipients={ccRecipients} />}
      {/* Activities carry no id; index within one immutable entry is stable. */}
      {activities.map((activity, index) => <ActivityRow key={index} activity={activity} />)}
    </Stack>
  );
}

export interface InstanceTimelineProps {
  timeline: TimelineEntry[];
}

/**
 * The chronological transit record of an instance: one entry per traversed
 * node (a rollback redo produces a second entry) plus the withdraw/terminate
 * milestones. Participants, carbon copies, and side activities render
 * beneath each node header.
 */
export function InstanceTimeline({ timeline }: InstanceTimelineProps) {
  if (timeline.length === 0) {
    return <Empty description="暂无流转记录" />;
  }

  const items: TimelineItem[] = timeline.map((entry, index) => {
    return {
      key: String(index),
      color: entryDotColor(entry),
      title: <EntryHeader entry={entry} />,
      content: <EntryBody entry={entry} />
    };
  });

  return <Timeline items={items} mode="left" />;
}
