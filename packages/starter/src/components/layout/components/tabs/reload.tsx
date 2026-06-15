import { emitReloadPage, IconButton } from "@vef-framework-react/components";
import { RefreshCwIcon } from "lucide-react";

import { useRouteFullPath } from "../../../../hooks";

interface ReloadProps {
  className?: string;
}

export function Reload({ className }: ReloadProps): React.JSX.Element {
  const fullPath = useRouteFullPath();

  function handleClick(): void {
    emitReloadPage(fullPath);
  }

  return (
    <IconButton
      className={className}
      icon={<RefreshCwIcon />}
      placement="bottom"
      tip="刷新页面"
      onClick={handleClick}
    />
  );
}
