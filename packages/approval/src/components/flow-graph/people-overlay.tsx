import type { CSSProperties } from "react";

import type { NodePerson, PersonTone } from "./people";

import { css } from "@emotion/react";
import { Avatar, Divider, Flex, globalCssVars, Popover, Stack, Tag } from "@vef-framework-react/components";

import { formatTimestamp } from "../format";
import { TaskStatusTag } from "../status";
import { ACTIVITY_ACTION_LABELS } from "../status/labels";
import { avatarColor } from "../user";
import { personTone } from "./people";

/**
 * Ring accent per tone, as adaptive theme tokens.
 */
const TONE_ACCENTS: Record<PersonTone, string> = {
  processing: globalCssVars.colorPrimary,
  success: globalCssVars.colorSuccess,
  error: globalCssVars.colorError,
  warning: globalCssVars.colorWarning,
  default: globalCssVars.colorBorder
};

/**
 * How many avatars stay visible before the group collapses into `+N`. Sized so
 * the strip stays narrower than the node card it floats over — beyond this the
 * avatars would out-measure the node and stop reading as belonging to it.
 */
const DEFAULT_MAX_AVATARS = 4;

const AVATAR_SIZE = 26;

/**
 * Floats the strip above the node card, centered and out of layout so the
 * node's measured box — the one xyflow anchors edges and handles to — stays
 * exactly the card.
 */
const overlayStyle = css({
  position: "absolute",
  bottom: "calc(100% + 6px)",
  left: "50%",
  transform: "translateX(-50%)",
  // Above sibling nodes and edges, so a strip never slides under the node to
  // its left.
  zIndex: 6,
  display: "flex",
  justifyContent: "center"
});

const nameStyle = css({
  fontWeight: 500,
  fontSize: globalCssVars.fontSizeSm
});

const metaStyle = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const opinionStyle = css({
  maxWidth: 260,
  padding: "4px 10px",
  borderInlineStart: `3px solid ${globalCssVars.colorBorder}`,
  background: globalCssVars.colorFillQuaternary,
  borderRadius: 4,
  fontSize: globalCssVars.fontSizeSm,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word"
});

const overflowListStyle = css({
  maxWidth: 280,
  maxHeight: 260,
  overflowY: "auto"
});

/**
 * Avatar style needs a per-person border color. It lands inline rather than in
 * a class because antd's group rule (`.ant-avatar-group .ant-avatar`) sets
 * `border-color` on every child and would otherwise win on specificity.
 */
function avatarStyle(person: NodePerson): CSSProperties {
  return {
    backgroundColor: avatarColor(person.user.id),
    borderColor: TONE_ACCENTS[personTone(person)],
    fontSize: Math.round(AVATAR_SIZE / 2),
    cursor: "default"
  };
}

function displayName(person: NodePerson): string {
  return person.user.name || person.user.id;
}

function initial(person: NodePerson): string {
  return displayName(person).slice(0, 1).toUpperCase();
}

/**
 * Name plus department when the snapshot carries one — the department is what
 * disambiguates two people with the same name.
 */
function PersonHeading({ person }: { person: NodePerson }) {
  return (
    <Flex align="center" gap={6}>
      <Avatar size={22} style={{ backgroundColor: avatarColor(person.user.id), fontSize: 11 }}>
        {initial(person)}
      </Avatar>

      <span css={nameStyle}>{displayName(person)}</span>
      {person.user.departmentName && <span css={metaStyle}>{person.user.departmentName}</span>}
    </Flex>
  );
}

/**
 * The hover card for one person. Each variant shows its own role's record —
 * a decision with its opinion, a read receipt, or a recorded action — rather
 * than flattening all three into a common shape that fits none of them.
 */
function PersonCard({ person }: { person: NodePerson }) {
  return (
    <Stack gap={6} style={{ minWidth: 160 }}>
      <PersonHeading person={person} />
      <Divider style={{ margin: 0 }} />
      {person.kind === "participant" && <ParticipantDetail person={person} />}
      {person.kind === "cc" && <CcDetail person={person} />}
      {person.kind === "operator" && <OperatorDetail person={person} />}
    </Stack>
  );
}

function ParticipantDetail({ person }: { person: Extract<NodePerson, { kind: "participant" }> }) {
  const { participant } = person;

  return (
    <Stack gap={6}>
      <Flex align="center" gap={6} wrap="wrap">
        <TaskStatusTag status={participant.status} />
        {participant.isTimeout && <Tag color="error">已超时</Tag>}
      </Flex>

      {participant.delegator
        && <span css={metaStyle}>{`受 ${participant.delegator.name || participant.delegator.id} 委托`}</span>}

      {participant.transferTo
        && <span css={metaStyle}>{`转办给 ${participant.transferTo.name || participant.transferTo.id}`}</span>}

      {participant.deadline && <span css={metaStyle}>{`截止 ${formatTimestamp(participant.deadline)}`}</span>}
      {participant.actionTime && <span css={metaStyle}>{formatTimestamp(participant.actionTime)}</span>}
      {participant.opinion && <div css={opinionStyle}>{participant.opinion}</div>}
    </Stack>
  );
}

function CcDetail({ person }: { person: Extract<NodePerson, { kind: "cc" }> }) {
  const { recipient } = person;

  return (
    <Flex align="center" gap={6} wrap="wrap">
      {recipient.readAt
        ? (
            <>
              <Tag color="success">已读</Tag>
              <span css={metaStyle}>{formatTimestamp(recipient.readAt)}</span>
            </>
          )
        : <Tag>未读</Tag>}
    </Flex>
  );
}

function OperatorDetail({ person }: { person: Extract<NodePerson, { kind: "operator" }> }) {
  const { activity } = person;

  return (
    <Stack gap={6}>
      <Flex align="center" gap={6} wrap="wrap">
        <Tag color="processing">{ACTIVITY_ACTION_LABELS[activity.action]}</Tag>
        <span css={metaStyle}>{formatTimestamp(activity.createdAt)}</span>
      </Flex>

      {activity.opinion && <div css={opinionStyle}>{activity.opinion}</div>}
    </Stack>
  );
}

/**
 * The collapsed remainder behind `+N`: one compact row per person rather than
 * a run-on name list, so the overflow stays as readable as the avatars it
 * stands in for.
 */
function OverflowList({ people }: { people: NodePerson[] }) {
  return (
    <Stack css={overflowListStyle} gap={10}>
      {people.map(person => (
        <div key={person.key}>
          <PersonCard person={person} />
        </div>
      ))}
    </Stack>
  );
}

export interface NodePeopleOverlayProps {
  people: NodePerson[];
  /**
   * Avatars shown before the group collapses into `+N`.
   *
   * @default 4
   */
  maxCount?: number;
}

/**
 * The people of one node, floated above its card as an avatar strip: who is
 * acting on it now, and who already acted. Each avatar's ring carries that
 * person's own outcome — which is what makes a half-decided parallel node
 * readable at a glance — and hovering one opens their record.
 *
 * Renders nothing for a node nobody has touched, so unreached nodes stay bare.
 */
export function NodePeopleOverlay({ people, maxCount = DEFAULT_MAX_AVATARS }: NodePeopleOverlayProps) {
  if (people.length === 0) {
    return null;
  }

  const hidden = people.slice(maxCount);

  return (
    // nodrag/nopan are xyflow's escape hatches: hovering or clicking an avatar
    // must open its card, never start a canvas gesture.
    <div className="nodrag nopan" css={overlayStyle}>
      <Avatar.Group
        size={AVATAR_SIZE}
        max={{
          count: maxCount,
          style: { fontSize: 11, cursor: "default" },
          popover: {
            placement: "top",
            // Overrides antd's default (the raw hidden avatars) — the spread
            // in AvatarGroup puts `max.popover` after its own `content`.
            content: <OverflowList people={hidden} />
          }
        }}
      >
        {people.map(person => (
          <Popover key={person.key} content={<PersonCard person={person} />} placement="top">
            <Avatar style={avatarStyle(person)}>{initial(person)}</Avatar>
          </Popover>
        ))}
      </Avatar.Group>
    </div>
  );
}
