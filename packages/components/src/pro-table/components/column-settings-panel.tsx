import { ReloadOutlined } from "@ant-design/icons";
import { css } from "@emotion/react";
import { DragDropProvider, RestrictToVerticalAxis } from "@vef-framework-react/core";
import { isDeepEqual } from "@vef-framework-react/shared";
import { memo, useCallback } from "react";

import { globalCssVars } from "../../_base";
import { Button } from "../../button";
import { Group } from "../../group";
import { Stack } from "../../stack";
import { useColumnSettingsStorageKey } from "../context";
import { clearColumnSettingsStorage } from "../hooks";
import { useProTableStore } from "../store";
import { ColumnSettingItem } from "./column-setting-item";

const panelStyle = css({
  minWidth: "260px",
  maxWidth: "50vw"
});

const titleStyle = css({
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary
});

const resetButtonStyle = css({
  boxSizing: "content-box",
  lineHeight: 1,
  paddingBlock: "calc(var(--vef-button-padding-inline-sm) / 2)",
  height: `calc(${globalCssVars.controlHeightSm} - 4px)`
});

const listContainerStyle = css({
  maxHeight: "380px",
  overflow: "auto"
});

const listStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px"
});

export const ColumnSettingsPanel = memo(() => {
  const storageKey = useColumnSettingsStorageKey();
  const columnSettings = useProTableStore(state => state.columnSettings);
  const isColumnSettingsChanged = useProTableStore(state => !isDeepEqual(state.columnSettings, state.originalColumnSettings));
  const reorderColumns = useProTableStore(state => state.reorderColumns);
  const resetColumnSettings = useProTableStore(state => state.resetColumnSettings);

  const handleReset = useCallback(() => {
    resetColumnSettings(
      storageKey
        ? () => clearColumnSettingsStorage(storageKey).skipNextSave()
        : undefined
    );
  }, [resetColumnSettings, storageKey]);

  return (
    <Stack css={panelStyle} gap="var(--vef-spacing-sm)">
      <Group justify="space-between">
        <span css={titleStyle}>数据列设置</span>

        <Button
          color="primary"
          css={resetButtonStyle}
          disabled={!isColumnSettingsChanged}
          icon={<ReloadOutlined />}
          size="small"
          variant="text"
          onClick={handleReset}
        >
          重置
        </Button>
      </Group>

      <div css={listContainerStyle}>
        <DragDropProvider
          modifiers={[RestrictToVerticalAxis as never]}
          onDragEnd={reorderColumns}
        >
          <div css={listStyle}>
            {columnSettings.map((column, index) => (
              <ColumnSettingItem
                key={column.id}
                columnId={column.id}
                fixed={column.fixed}
                index={index}
                title={column.title}
                visible={column.visible}
                width={column.width}
              />
            ))}
          </div>
        </DragDropProvider>
      </div>
    </Stack>
  );
});

ColumnSettingsPanel.displayName = "ColumnSettingsPanel";
