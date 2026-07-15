import type { UserInfo, UserMenuItem } from "@vef-framework-react/starter";
import type { ReactElement } from "react";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { Icon, showInfoMessage } from "@vef-framework-react/components";
import { createLayoutRouteOptions, useAppStore } from "@vef-framework-react/starter";
import { LockKeyholeIcon } from "lucide-react";
import { apiClient } from "~api";
import { getUserInfo, logout } from "~apis";
import { FileViewerPreviewHost } from "~components";
import { APPS, getAppConfig } from "~helpers";

const SELECT_APP_ROUTE_PATH = "/select-app";

async function handleLogout(): Promise<void> {
  await apiClient.executeMutation({ mutationFn: logout });
}

function fetchUserInfo(): Promise<UserInfo> {
  const { appId } = useAppStore.getState().custom;

  if (!appId) {
    throw redirect({ to: SELECT_APP_ROUTE_PATH });
  }

  return apiClient.fetchQuery({
    queryKey: [getUserInfo.key, { appId }],
    queryFn: getUserInfo
  });
}

const userMenuItems: UserMenuItem[] = [
  {
    key: "changePassword",
    icon: <Icon component={LockKeyholeIcon} />,
    label: "修改密码"
  }
];

function handleUserMenuClick(key: string): void {
  if (key === "changePassword") {
    showInfoMessage("修改密码（demo）");
  }
}

function handleAppChange(appId: string): void {
  useAppStore.setState(state => {
    state.custom.appId = appId;
  });
  // Switching the whole sub-app: hard-reload to its home so the menu, permissions
  // and query cache rebuild cleanly for the freshly selected app.
  location.assign("/");
}

const layoutRouteOptions = createLayoutRouteOptions({
  title: getAppConfig("title"),
  apps: APPS,
  currentAppId: useAppStore.getState().custom.appId,
  userMenuItems,
  onLogout: handleLogout,
  onUserMenuClick: handleUserMenuClick,
  onAppChange: handleAppChange,
  fetchUserInfo
});

const LayoutComponent = layoutRouteOptions.component;

// Wrap the starter layout with the file-preview host so every Upload /
// FileUpload / UploadField under the authenticated layout dispatches
// non-image previews to <FileViewer>.
function LayoutWithFilePreview(): ReactElement {
  return (
    <FileViewerPreviewHost>
      <LayoutComponent />
    </FileViewerPreviewHost>
  );
}

export const Route = createFileRoute("/_layout")({
  ...layoutRouteOptions,
  component: LayoutWithFilePreview
});
