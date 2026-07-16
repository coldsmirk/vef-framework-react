import type { UserInfo } from "../../types";

import { Avatar, Space, Text, Tooltip } from "@vef-framework-react/components";

/**
 * Deterministic avatar hue per user id, drawn from the antd preset palette so
 * the same person keeps the same color across every approval view.
 */
const AVATAR_COLORS = [
  "var(--vef-color-primary)",
  "#f56a00",
  "#7265e6",
  "#00a2ae",
  "#c41d7f",
  "#1677ff",
  "#389e0d",
  "#d46b08"
] as const;

function avatarColor(id: string): string {
  let hash = 0;

  for (const char of id) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_000_007;
  }

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

export interface UserLabelProps {
  user: UserInfo;
  /**
   * Render the avatar in front of the name.
   *
   * @default true
   */
  showAvatar?: boolean;
  /**
   * Avatar size in pixels.
   *
   * @default 22
   */
  avatarSize?: number;
}

/**
 * A person snapshot as avatar + name, with the department (when the snapshot
 * carries one) surfaced in the tooltip. Renders the id when the name is empty
 * — the backend returns missing users with an empty name rather than
 * omitting them.
 */
export function UserLabel({
  user,
  showAvatar = true,
  avatarSize = 22
}: UserLabelProps) {
  const displayName = user.name || user.id;
  const tooltip = user.departmentName ? `${displayName} · ${user.departmentName}` : displayName;

  return (
    <Tooltip title={tooltip}>
      <Space size={6} style={{ display: "inline-flex", alignItems: "center" }}>
        {showAvatar && (
          <Avatar size={avatarSize} style={{ backgroundColor: avatarColor(user.id), fontSize: Math.round(avatarSize / 2) }}>
            {displayName.slice(0, 1).toUpperCase()}
          </Avatar>
        )}

        <Text>{displayName}</Text>
      </Space>
    </Tooltip>
  );
}

export interface UserGroupProps {
  users: UserInfo[];
  /**
   * Collapse into `+N` beyond this count.
   *
   * @default 5
   */
  maxCount?: number;
  avatarSize?: number;
}

/**
 * A compact list of person snapshots, collapsing the overflow into a `+N`
 * avatar whose tooltip lists the hidden names.
 */
export function UserGroup({
  users,
  maxCount = 5,
  avatarSize = 22
}: UserGroupProps) {
  if (users.length === 0) {
    return <Text type="secondary">-</Text>;
  }

  const visible = users.slice(0, maxCount);
  const hidden = users.slice(maxCount);

  return (
    <Space wrap size={8}>
      {visible.map(user => <UserLabel key={user.id} avatarSize={avatarSize} user={user} />)}

      {hidden.length > 0 && (
        <Tooltip title={hidden.map(user => user.name || user.id).join("、")}>
          <Avatar size={avatarSize} style={{ fontSize: Math.round(avatarSize / 2) }}>{`+${hidden.length}`}</Avatar>
        </Tooltip>
      )}
    </Space>
  );
}
