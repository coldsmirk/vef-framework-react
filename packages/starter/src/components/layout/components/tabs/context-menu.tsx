import type { DropdownMenuProps } from "@vef-framework-react/components";
import type { PropsWithChildren } from "react";

import { Dropdown, Icon } from "@vef-framework-react/components";
import { useShallow } from "@vef-framework-react/core";
import { ArrowLeftFromLineIcon, ArrowRightFromLineIcon, ChevronsLeftRightEllipsisIcon, ChevronsRightLeftIcon, XIcon } from "lucide-react";

import { useTabStore } from "../../../../stores";
import { useTabNavigate } from "../../hooks";

interface ContextMenuProps extends PropsWithChildren {
  tabId: string;
}

const contextMenuOptions: DropdownMenuProps["items"] = [
  {
    key: "close",
    icon: <Icon component={XIcon} />,
    label: "关闭"
  },
  {
    key: "close-other",
    icon: <Icon component={ChevronsLeftRightEllipsisIcon} />,
    label: "关闭其他"
  },
  {
    key: "close-left",
    icon: <Icon component={ArrowLeftFromLineIcon} />,
    label: "关闭左侧"
  },
  {
    key: "close-right",
    icon: <Icon component={ArrowRightFromLineIcon} />,
    label: "关闭右侧"
  },
  {
    key: "close-all",
    icon: <Icon component={ChevronsRightLeftIcon} />,
    label: "关闭所有"
  }
];

export function ContextMenu({ children, tabId }: ContextMenuProps) {
  const {
    removeTab,
    removeAllTabs,
    removeAllTabsExcept,
    removeLeftTabs,
    removeRightTabs
  } = useTabStore(
    useShallow(({
      removeTab,
      removeAllTabs,
      removeAllTabsExcept,
      removeLeftTabs,
      removeRightTabs
    }) => {
      return {
        removeTab,
        removeAllTabs,
        removeAllTabsExcept,
        removeLeftTabs,
        removeRightTabs
      };
    })
  );
  const navigate = useTabNavigate({
    async: true
  });

  function handleMenuClick({ key }: { key: string }): void {
    switch (key) {
      case "close": {
        removeTab(tabId, navigate);
        break;
      }

      case "close-other": {
        removeAllTabsExcept(tabId, navigate);
        break;
      }

      case "close-left": {
        removeLeftTabs(tabId, navigate);
        break;
      }

      case "close-right": {
        removeRightTabs(tabId, navigate);
        break;
      }

      case "close-all": {
        removeAllTabs(navigate);
        break;
      }
    }
  }

  return (
    <Dropdown
      trigger={["contextMenu"]}
      menu={{
        items: contextMenuOptions,
        onClick: handleMenuClick
      }}
    >
      {children}
    </Dropdown>
  );
}
