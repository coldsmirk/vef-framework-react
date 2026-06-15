import type { Key } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import { ColumnWidthOutlined, HolderOutlined, VerticalAlignBottomOutlined, VerticalAlignTopOutlined } from "@ant-design/icons";
import { css } from "@emotion/react";
import { useSortable } from "@vef-framework-react/core";
import { isUndefined } from "@vef-framework-react/shared";
import { memo, useCallback } from "react";

import { globalCssVars } from "../../_base";
import { Checkbox } from "../../checkbox";
import { Divider } from "../../divider";
import { Group } from "../../group";
import { Tooltip } from "../../tooltip";
import { useProTableStore } from "../store";
import { WidthPopover } from "./width-popover";

interface ColumnSettingItemProps {
  columnId: Key;
  title: ReactNode;
  fixed?: "start" | "end" | false;
  width?: number;
  visible: boolean;
  index: number;
}

const itemStyle = css({
  display: "flex",
  alignItems: "center",
  gap: globalCssVars.spacingXs,
  padding: globalCssVars.spacingXs,
  borderRadius: globalCssVars.borderRadius,
  transition: `background ${globalCssVars.motionDurationMid}`,

  "&:hover": {
    backgroundColor: globalCssVars.colorFillTertiary
  }
});
const dragHandleStyle = css({
  display: "flex",
  alignItems: "center",
  cursor: "grab",
  color: globalCssVars.colorTextQuaternary,
  paddingInlineEnd: globalCssVars.spacingXs,

  "&:hover": {
    color: globalCssVars.colorTextTertiary
  },

  "&:active": {
    cursor: "grabbing"
  }
});
const titleStyle = css({
  flex: "auto",
  color: globalCssVars.colorText,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});
const actionButtonStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  borderRadius: globalCssVars.borderRadiusXs,
  cursor: "pointer",
  color: globalCssVars.colorTextSecondary,
  transitionProperty: "color, background-color",
  transitionDuration: globalCssVars.motionDurationMid,

  "&:hover": {
    color: globalCssVars.colorPrimary
  }
});
const activeButtonStyle = css({
  color: globalCssVars.colorPrimary,
  backgroundColor: globalCssVars.colorPrimaryBg
});
const disabledButtonStyle = css({
  color: globalCssVars.colorTextDisabled,
  cursor: "not-allowed",

  "&:hover": {
    color: globalCssVars.colorTextDisabled
  }
});
const dividerStyle = css({
  marginInline: "2px"
});
const draggingStyle = css({
  boxShadow: globalCssVars.boxShadowSecondary,
  backgroundColor: globalCssVars.colorBgElevated
});

export const ColumnSettingItem = memo<ColumnSettingItemProps>(({
  columnId,
  title,
  fixed,
  width,
  visible,
  index
}) => {
  const {
    ref,
    handleRef,
    isDragging
  } = useSortable({
    id: columnId,
    index
  });

  const setColumnFixed = useProTableStore(state => state.setColumnFixed);
  const setColumnWidth = useProTableStore(state => state.setColumnWidth);
  const setColumnVisible = useProTableStore(state => state.setColumnVisible);

  const handleFixStart = useCallback(() => {
    setColumnFixed(columnId, fixed === "start" ? false : "start");
  }, [columnId, fixed, setColumnFixed]);

  const handleFixEnd = useCallback(() => {
    setColumnFixed(columnId, fixed === "end" ? false : "end");
  }, [columnId, fixed, setColumnFixed]);

  const handleWidthChange = useCallback((newWidth: number) => {
    setColumnWidth(columnId, newWidth);
  }, [columnId, setColumnWidth]);

  const handleVisibleChange = useCallback((checked: boolean) => {
    setColumnVisible(columnId, checked);
  }, [columnId, setColumnVisible]);

  const isWidthSettingDisabled = isUndefined(width);

  return (
    <div
      ref={ref}
      css={[itemStyle, isDragging && draggingStyle]}
    >
      <span ref={handleRef} css={dragHandleStyle}>
        <HolderOutlined />
      </span>

      <Checkbox
        checked={visible}
        onChange={e => handleVisibleChange(e.target.checked)}
      />

      <span css={titleStyle}>
        {title || "未命名列"}
      </span>

      <Group gap={0}>
        <Tooltip title={fixed === "start" ? "取消固定在左侧" : "固定在左侧"}>
          <span
            css={[actionButtonStyle, fixed === "start" && activeButtonStyle]}
            onClick={handleFixStart}
          >
            <VerticalAlignTopOutlined rotate={-90} />
          </span>
        </Tooltip>

        <Divider css={dividerStyle} orientation="vertical" />

        <Tooltip title={fixed === "end" ? "取消固定在右侧" : "固定在右侧"}>
          <span
            css={[actionButtonStyle, fixed === "end" && activeButtonStyle]}
            onClick={handleFixEnd}
          >
            <VerticalAlignBottomOutlined rotate={-90} />
          </span>
        </Tooltip>

        <Divider css={dividerStyle} orientation="vertical" />

        <WidthPopover
          currentWidth={width}
          disabled={isWidthSettingDisabled}
          onWidthChange={handleWidthChange}
        >
          <Tooltip title={isWidthSettingDisabled ? "该列不支持设置列宽" : "设置列宽"}>
            <span css={[actionButtonStyle, isWidthSettingDisabled && disabledButtonStyle]}>
              <ColumnWidthOutlined />
            </span>
          </Tooltip>
        </WidthPopover>
      </Group>
    </div>
  );
});

ColumnSettingItem.displayName = "ColumnSettingItem";
