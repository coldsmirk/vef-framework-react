import type { ReactNode } from "react";

import { globalCssVars } from "../../_base";
import { Group } from "../../group";
import { SelectionIndicator } from "./selection-indicator";

interface ToolbarActionsProps {
  toolbarActions?: ReactNode;
}

export function ToolbarActions({ toolbarActions }: ToolbarActionsProps) {
  return (
    <Group gap={globalCssVars.spacingSm}>
      {toolbarActions}
      <SelectionIndicator />
    </Group>
  );
}
