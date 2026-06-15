import { IconButton } from "@vef-framework-react/components";
import { useFullscreenDocument } from "@vef-framework-react/hooks";
import { isNullish } from "@vef-framework-react/shared";
import { MaximizeIcon, MinimizeIcon } from "lucide-react";

interface FullscreenProps {
  className?: string;
}

export function Fullscreen({ className }: FullscreenProps): React.JSX.Element {
  const { toggle, fullscreen } = useFullscreenDocument();
  const isFullscreen = !isNullish(document.fullscreenElement) || fullscreen;
  const icon = isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />;
  const tip = isFullscreen ? "退出全屏" : "全屏";

  return (
    <IconButton
      className={className}
      icon={icon}
      size="large"
      tip={tip}
      onClick={toggle}
    />
  );
}
