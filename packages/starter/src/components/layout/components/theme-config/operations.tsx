import { Button, Icon, showSuccessMessage } from "@vef-framework-react/components";
import { RefreshCwIcon } from "lucide-react";

import { useThemeStore } from "../../../../stores";

function handleReset(): void {
  useThemeStore.setState(
    {
      ...useThemeStore.getInitialState(),
      isThemeConfigVisible: true
    },
    true
  );

  showSuccessMessage("主题配置已重置成功");
}

export function Operations(): React.JSX.Element {
  return (
    <Button
      block
      danger
      icon={<Icon component={RefreshCwIcon} />}
      onClick={handleReset}
    >
      重置配置
    </Button>
  );
}
