import type { MaybeNull, MaybeUndefined } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import { css } from "@emotion/react";
import { Button, globalCssVars, Group, Icon, showInfoNotification, Text } from "@vef-framework-react/components";
import { joinPaths } from "@vef-framework-react/shared";
import { compareVersions } from "compare-versions";
import { CircleArrowUpIcon } from "lucide-react";

export interface AppChangelog {
  version: string;
  date?: string;
  description?: string;
  changes?: string[];
}

interface LatestVersionInfo {
  version?: string;
  changelog?: AppChangelog;
}

export interface AppVersionNotificationOptions {
  enabled?: boolean;
  basePath?: string;
  checkInterval?: number;
  title?: ReactNode;
  description?: ReactNode;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const versionStyle = css({
  fontSize: "inherit",
  fontFamily: globalCssVars.fontFamilyCode
});

const mainDescriptionStyle = css({
  marginBottom: globalCssVars.spacingSm
});

const changelogDescStyle = css({
  marginBottom: globalCssVars.spacingSm,
  padding: globalCssVars.spacingSm,
  backgroundColor: globalCssVars.colorFillQuaternary,
  borderLeft: `3px solid ${globalCssVars.colorPrimary}`,
  borderRadius: globalCssVars.borderRadius
});

const changesTitleStyle = css({
  fontWeight: 600,
  color: globalCssVars.colorInfo,
  display: "flex",
  alignItems: "center",
  gap: globalCssVars.spacingXxs
});

const changesListStyle = css({
  paddingLeft: globalCssVars.spacingXl,
  fontSize: `calc(${globalCssVars.fontSize} - 1px)`,
  marginTop: globalCssVars.spacingXxs,
  marginBottom: globalCssVars.spacingSm,
  "& > li": {
    color: globalCssVars.colorTextSecondary
  }
});

const dateInfoStyle = css({
  textAlign: "right",
  borderTop: `${globalCssVars.lineWidth} ${globalCssVars.lineType} ${globalCssVars.colorBorderSecondary}`,
  paddingTop: globalCssVars.spacingXxs,
  "> .vef-typography": {
    fontSize: globalCssVars.fontSizeSm
  }
});

function getCurrentVersion(): string | null | undefined {
  const meta = document.querySelector(`meta[name="app-version"]`);
  return meta?.getAttribute("content");
}

async function getLatestVersionInfo(basePath: string): Promise<LatestVersionInfo> {
  const result: LatestVersionInfo = {};

  const url = joinPaths(basePath, "index.html");
  const response = await fetch(`${url}?t=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch HTML: ${response.status}`);
  }

  const html = await response.text();

  const versionMetaMatch = html.match(/<meta[^>]*name="app-version"[^>]*>/);
  const versionContentMatch = versionMetaMatch?.[0].match(/content="(?<version>[^"]+)"/);
  const version = versionContentMatch?.groups?.version || "";
  result.version = version;

  const changelogMetaMatch = html.match(/<meta[^>]*name="app-changelog"[^>]*>/);
  const changelogContentMatch = changelogMetaMatch?.[0].match(/content="(?<path>[^"]+)"/);
  const changelogPath = changelogContentMatch?.groups?.path;

  let changelog: MaybeUndefined<AppChangelog>;

  if (changelogPath) {
    const changelogUrl = joinPaths(basePath, changelogPath);
    const changelogResponse = await fetch(`${changelogUrl}?t=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
    });

    if (changelogResponse.ok) {
      const changelogs = await changelogResponse.json() as AppChangelog[];
      changelog = changelogs.find(item => item.version === version);
    }
  }

  return { version, changelog };
}

export function setupAppVersionNotification(options: AppVersionNotificationOptions = {}): (() => void) | undefined {
  const {
    enabled = false,
    basePath = "/",
    checkInterval = 60,
    title = "发现新版本",
    description = "检测到应用有新版本，建议刷新页面以获取最新功能和修复（注意：如果您正在编辑数据，请在更新前请一定要先保存/提交）",
    confirmText = "立即更新",
    cancelText = "稍后再说",
    onConfirm,
    onCancel
  } = options;

  if (!enabled) {
    return;
  }

  let isNotificationShown = false;
  let checkTimer: MaybeNull<ReturnType<typeof setInterval>> = null;

  function buildDescriptionContent(changelog: AppChangelog): ReactNode {
    const parts: ReactNode[] = [];

    if (description) {
      parts.push(
        <div key="description" css={mainDescriptionStyle}>
          {description}
        </div>
      );
    }

    if (changelog.description) {
      parts.push(
        <div key="changelog-desc" css={changelogDescStyle}>
          {changelog.description}
        </div>
      );
    }

    if (changelog.changes && changelog.changes.length > 0) {
      parts.push(
        <div key="changes-container">
          <div css={changesTitleStyle}>
            <span>📋</span>
            <span>本次更新内容：</span>
          </div>

          <ul css={changesListStyle}>
            {changelog.changes.map(change => <li key={change}>{change}</li>)}
          </ul>
        </div>
      );
    }

    if (changelog.date) {
      parts.push(
        <div key="date-info" css={dateInfoStyle}>
          <Text type="secondary">{changelog.date}</Text>
        </div>
      );
    }

    return <>{parts}</>;
  }

  function stopCheckTimer(): void {
    if (!checkTimer) {
      return;
    }

    clearInterval(checkTimer);
    checkTimer = null;
  }

  function showUpdateNotification(changelog: AppChangelog): void {
    isNotificationShown = true;
    stopCheckTimer();

    const notification = showInfoNotification(buildDescriptionContent(changelog), {
      icon: "🎉",
      title: (
        <>
          <span>{title}</span>
          {" - "}

          <Text strong css={versionStyle} type="success">
            v
            {changelog.version}
          </Text>
        </>
      ),
      duration: 0,
      closable: false,
      actions: (
        <Group>
          <Button
            key="cancel"
            onClick={() => {
              notification.close();
              onCancel?.();
            }}
          >
            {cancelText}
          </Button>

          <Button
            key="confirm"
            icon={<Icon component={CircleArrowUpIcon} />}
            type="primary"
            onClick={() => {
              if (onConfirm) {
                onConfirm();
              } else {
                location.reload();
              }
            }}
          >
            {confirmText}
          </Button>
        </Group>
      )
    });
  }

  async function checkForUpdate(): Promise<void> {
    if (isNotificationShown) {
      return;
    }

    try {
      const currentVersion = getCurrentVersion();
      const { version: latestVersion, changelog } = await getLatestVersionInfo(basePath);

      if (!currentVersion || !latestVersion || currentVersion === latestVersion) {
        return;
      }

      if (compareVersions(latestVersion, currentVersion) === 1) {
        showUpdateNotification(changelog ?? { version: latestVersion });
      }
    } catch (error) {
      console.warn("[App Version Check] Failed to check for updates:", error);
    }
  }

  function startCheckTimer(): void {
    stopCheckTimer();

    if (checkInterval > 0) {
      checkTimer = setInterval(checkForUpdate, checkInterval * 1000);
    }
  }

  function handleVisibilityChange(): void {
    if (document.visibilityState === "visible") {
      checkForUpdate();
      startCheckTimer();
    } else {
      stopCheckTimer();
    }
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (document.visibilityState === "visible") {
    checkForUpdate();
    startCheckTimer();
  }

  return () => {
    stopCheckTimer();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
