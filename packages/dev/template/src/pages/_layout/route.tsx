import type { UserInfo, UserMenuItem } from "@vef-framework-react/starter";

import { createFileRoute } from "@tanstack/react-router";
import { Icon, showInfoMessage } from "@vef-framework-react/components";
import { createLayoutRouteOptions } from "@vef-framework-react/starter";
import { LockKeyholeIcon } from "lucide-react";
import { apiClient } from "~api";
import { getUserInfo, logout } from "~apis";
import { getAppConfig } from "~helpers";

async function handleLogout(): Promise<void> {
  await apiClient.executeMutation({ mutationFn: logout });
}

function fetchUserInfo(): Promise<UserInfo> {
  return apiClient.fetchQuery({
    queryKey: [getUserInfo.key],
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
    showInfoMessage("修改密码");
  }
}

export const Route = createFileRoute("/_layout")(
  createLayoutRouteOptions({
    title: getAppConfig("title"),
    userMenuItems,
    onLogout: handleLogout,
    onUserMenuClick: handleUserMenuClick,
    fetchUserInfo
  })
);
