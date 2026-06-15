import { IconButton } from "@vef-framework-react/components";
import { ExpandIcon, ShrinkIcon } from "lucide-react";

import { useThemeStore } from "../../../../stores";

interface MainContentMaximumProps {
  className?: string;
}

export function MainContentMaximum({ className }: MainContentMaximumProps): React.JSX.Element {
  const isMainContentMaximum = useThemeStore(state => state.isMainContentMaximum);
  const icon = isMainContentMaximum ? <ShrinkIcon /> : <ExpandIcon />;
  const tip = isMainContentMaximum ? "退出内容最大化" : "内容最大化";

  function handleClick(): void {
    useThemeStore.setState(state => {
      state.isMainContentMaximum = !state.isMainContentMaximum;
    });
  }

  return (
    <IconButton
      className={className}
      icon={icon}
      placement="bottom"
      tip={tip}
      onClick={handleClick}
    />
  );
}
