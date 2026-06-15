import { SettingOutlined } from "@ant-design/icons";
import { isDeepEqual } from "@vef-framework-react/shared";
import { memo, useState } from "react";

import { Badge } from "../../badge";
import { Popover } from "../../popover";
import { useProTableStore } from "../store";
import { ColumnSettingsPanel } from "./column-settings-panel";

interface ColumnSettingsProps {
  className?: string;
}

const DOT_OFFSET: [number, number] = [-8, 8];

export const ColumnSettings = memo<ColumnSettingsProps>(({ className }) => {
  const isColumnSettingsChanged = useProTableStore(state => !isDeepEqual(state.columnSettings, state.originalColumnSettings));
  const [open, setOpen] = useState(false);

  return (
    <Popover
      content={<ColumnSettingsPanel />}
      open={open}
      placement="bottomRight"
      trigger="click"
      onOpenChange={setOpen}
    >
      <Badge
        dot={isColumnSettingsChanged}
        offset={DOT_OFFSET}
        size="small"
        title="调整过列设置"
      >
        <SettingOutlined className={className} />
      </Badge>
    </Popover>
  );
});

ColumnSettings.displayName = "ColumnSettings";
