import type { DropdownMenuProps } from "@vef-framework-react/components";

import type { LayoutProps } from "../../props";

import { css } from "@emotion/react";
import { useRouter } from "@tanstack/react-router";
import { Avatar, Button, Dropdown, globalCssVars, Icon, showConfirm } from "@vef-framework-react/components";
import { LogOutIcon } from "lucide-react";
import { useMemo } from "react";

import { handleClientLogout } from "../../../../helpers";
import { useAppStore } from "../../../../stores";
import { BoyIcon } from "./boy-icon";
import { GirlIcon } from "./girl-icon";

interface UserAvatarProps extends Pick<LayoutProps, "userMenuItems" | "onUserMenuClick" | "onLogout"> {
  className?: string;
}

const buttonStyle = css({
  fontSize: "var(--vef-button-content-font-size)",
  borderRadius: globalCssVars.borderRadius,
  transition: `all ${globalCssVars.motionDurationMid} ease`,

  "&:hover": {
    backgroundColor: globalCssVars.colorFillTertiary
  }
});
const menuItemStyle = css({
  display: "flex",
  alignItems: "center",
  columnGap: globalCssVars.spacingXs
});

const builtinMenuItems: NonNullable<DropdownMenuProps["items"]> = [
  {
    key: "logout",
    label: (
      <div css={menuItemStyle}>
        <Icon component={LogOutIcon} />
        <span>退出登录</span>
      </div>
    )
  }
];

export function UserAvatar({
  className,
  userMenuItems,
  onUserMenuClick,
  onLogout
}: UserAvatarProps) {
  const router = useRouter();
  const userInfo = useAppStore(state => state.userInfo);
  const {
    name = "佚名",
    gender = "male",
    avatar
  } = userInfo ?? {};
  const menuProps = useMemo<DropdownMenuProps>(() => {
    const hasUserItems = !!userMenuItems?.length;
    const items: NonNullable<DropdownMenuProps["items"]> = hasUserItems
      ? [...userMenuItems, { type: "divider" }, ...builtinMenuItems]
      : [...builtinMenuItems];

    return {
      items,
      onClick: ({ key }) => {
        if (key === "logout") {
          showConfirm(
            "确定要退出登录吗？",
            {
              title: "退出登录",
              onOk: async () => {
                await onLogout?.();
                await handleClientLogout(router);
              }
            }
          );
          return;
        }

        onUserMenuClick?.(key);
      }
    };
  }, [userMenuItems, onUserMenuClick, onLogout, router]);

  const avatarIcon = gender === "female" ? <GirlIcon /> : <BoyIcon />;

  return (
    <Dropdown
      menu={menuProps}
      placement="bottomRight"
      trigger={["click"]}
    >
      <Button
        className={className}
        css={buttonStyle}
        size="large"
        type="text"
      >
        <Avatar src={avatar || avatarIcon} />
        {name}
      </Button>
    </Dropdown>
  );
}
