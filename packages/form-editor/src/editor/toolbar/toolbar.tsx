import type { DropdownMenuItem, DropdownMenuProps, DynamicIconName } from "@vef-framework-react/components";
import type { ReactElement, ReactNode } from "react";

import type { EditorDeviceMode } from "../../store/form-store";
import type { FormSchema } from "../../types";
import type { SchemaIoMode } from "./schema-io";

import { css } from "@emotion/react";
import { Button, Dropdown, globalCssVars, Tooltip } from "@vef-framework-react/components";
import { useState } from "react";

import { validateSchema } from "../../engine/schema/validate";
import { formatIssueLine } from "../../engine/validation";
import { EditorIcon } from "../../icons";
import { useDeviceRegistries } from "../../store/engine-provider";
import { selectFieldCount, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { useEditorLayout } from "../editor-layout-context";
import { IssueList } from "../validation-summary";
import { confirmDialog, notify } from "./notify";
import { SchemaIoModal } from "./schema-io";

const toolbarCss = css({
  display: "flex",
  alignItems: "center",
  gap: 14,
  height: 64,
  padding: "0 22px",
  background: globalCssVars.colorBgContainer,
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorText,
  boxShadow: `inset 0 -1px 0 ${globalCssVars.colorBorderSecondary}`,
  position: "relative",
  zIndex: 2,
  flexShrink: 0,

  // Drawer mode (narrow host) trims gaps so the condensed buttons can breathe.
  "&[data-layout='drawer']": {
    gap: 8,
    padding: "0 12px"
  }
});

const brandCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  flexShrink: 0,
  whiteSpace: "nowrap"
});

const brandMarkCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: globalCssVars.borderRadiusSm,
  background: globalCssVars.colorPrimary,
  color: globalCssVars.colorWhite,

  "& > svg": {
    width: 18,
    height: 18
  }
});

const brandNameCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText,
  letterSpacing: 0
});

const brandTagCss = css({
  display: "inline-flex",
  alignItems: "center",
  height: 20,
  padding: "0 8px",
  borderRadius: 999,
  // A hairline outline badge (not a filled chip), so the version tag reads as a
  // label rather than another button.
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  letterSpacing: 0,
  color: globalCssVars.colorTextSecondary,
  fontVariantNumeric: "tabular-nums"
});

const togglePillsCss = css({
  display: "inline-flex",
  alignItems: "stretch",
  gap: 3,
  padding: 4,
  borderRadius: 10,
  // A slightly stronger track so the inset segmented control reads as a
  // container holding the raised active thumb.
  background: globalCssVars.colorFillTertiary
});

const togglePillCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 36,
  minHeight: 36,
  padding: "0 14px",
  border: "none",
  borderRadius: 8,
  background: "transparent",
  color: globalCssVars.colorTextSecondary,
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  lineHeight: 1,
  cursor: "pointer",
  transition: `background-color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}, color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "& > svg": {
    width: 16,
    height: 16
  },

  "&:hover": {
    color: globalCssVars.colorText
  }
});

const togglePillCompactCss = css({
  width: 36,
  padding: 0,
  justifyContent: "center"
});

const togglePillActiveCss = css({
  // The selected segment is a raised neutral thumb on the track (the antd
  // `Segmented` idiom) rather than a primary flood — selection reads clearly
  // while the saturated accent stays reserved for the publish CTA.
  background: globalCssVars.colorBgContainer,
  color: globalCssVars.colorText,
  boxShadow: globalCssVars.shadowXxs,

  "&:hover": {
    background: globalCssVars.colorBgContainer,
    color: globalCssVars.colorText
  }
});

const summarySpacerCss = css({
  flex: 1,
  minWidth: 0
});

const summaryChipCss = css({
  // Passive status text, not a control — no fill, just a leading icon and the
  // count, so it does not read as another chip-shaped button.
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 28,
  color: globalCssVars.colorTextSecondary,
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  letterSpacing: 0,
  whiteSpace: "nowrap",
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",

  "& > svg": {
    width: 14,
    height: 14,
    color: globalCssVars.colorTextTertiary
  }
});

const dividerCss = css({
  width: 1,
  height: 24,
  background: globalCssVars.colorBorderSecondary,
  flexShrink: 0
});

const toolbarActionButtonCss = css({
  height: 36,
  paddingInline: 14,
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,

  "& svg": {
    width: 16,
    height: 16
  }
});

const toolbarIconButtonCss = css(toolbarActionButtonCss, {
  width: 36,
  paddingInline: 0
});

const primaryActionButtonCss = css(toolbarActionButtonCss, {
  // antd's primary Button already carries its own elevation; the bespoke accent
  // glow is dropped so the CTA reads as a button, not a beacon.
  paddingInline: 18,
  fontWeight: 600
});

/**
 * Static menu surfaced under the "更多" dropdown in the drawer layout.
 * Hoisted to module scope because nothing in it depends on render state —
 * keeping it here lets antd Dropdown reuse the same items reference across
 * renders so its internal Menu does not need to diff the array.
 */
const MORE_MENU_ITEMS: DropdownMenuItem[] = [
  {
    key: "import",
    label: "导入 Schema",
    icon: <EditorIcon name="upload" />
  },
  {
    key: "export",
    label: "导出 Schema",
    icon: <EditorIcon name="download" />
  },
  { type: "divider" },
  {
    key: "clear",
    label: "清空表单",
    danger: true,
    icon: <EditorIcon name="trash-2" />
  }
];

/**
 * Brand shown at the toolbar's left edge. Consumers override the name/tag/icon
 * so a downstream app does not ship the framework's own label or glyph.
 */
export interface ToolbarBrand {
  name?: string;
  tag?: string;
  /**
   * Brand mark rendered at the very left. Defaults to the built-in clipboard
   * glyph.
   */
  icon?: ReactNode;
}

export interface ToolbarProps {
  /**
   * Brand label/tag. Defaults to the framework name with no version tag.
   */
  brand?: ToolbarBrand;
  /**
   * Publish hook, invoked with the current schema after a pre-publish
   * validation pass (warnings ask the designer for confirmation first).
   * Publishing is host semantics — when omitted, the publish button is not
   * rendered at all.
   */
  onPublish?: (schema: FormSchema) => void;
  /**
   * Label for the publish button (defaults to "发布").
   */
  publishText?: string;
  /**
   * Whether the publish button shows a loading state.
   */
  publishLoading?: boolean;
}

/**
 * Editor top toolbar. Houses brand, summary, device / view-mode switches,
 * history, schema IO, and the publish CTA.
 *
 * Visual style: pill-shaped toggles for binary mode controls, ghost buttons
 * for utility actions, and a primary `发布` button as the CTA on the right.
 *
 * Layout adaptivity (via `useEditorLayout`):
 * - `docked`: full toolbar, every action visible
 * - `drawer`: import/export/clear collapse into a "更多" menu, the toggle pills
 * drop their labels, and the summary chip hides
 */
export function Toolbar({
  brand,
  onPublish,
  publishText,
  publishLoading
}: ToolbarProps): ReactElement {
  const pastLength = useFormEditorStore(s => s.past.length);
  const futureLength = useFormEditorStore(s => s.future.length);
  // Selecting the reduced primitive keeps the toolbar from re-rendering on
  // every unrelated mutation — it only re-runs when the count shifts. Counts
  // reflect the active device's presentation.
  const fieldsCount = useFormEditorStore(selectFieldCount);
  const viewMode = useFormEditorStore(s => s.viewMode);
  const device = useFormEditorStore(s => s.device);
  const storeApi = useFormEditorStoreApi();
  const registries = useDeviceRegistries();
  const layout = useEditorLayout();

  const [ioMode, setIoMode] = useState<SchemaIoMode>(null);

  const isCondensed = layout === "drawer";
  const showSummary = layout !== "drawer";

  const handleClear = (): void => {
    if (fieldsCount === 0) {
      notify("success", "当前表单已为空");
      return;
    }

    confirmDialog("确认清空当前表单？", "该操作可通过撤销恢复。", {
      onOk: () => {
        storeApi.getState().clearSchema();
      }
    });
  };

  // Pre-publish validation outlet: the schema's structured issues (65 codes,
  // warnings included) finally reach the designer at the moment that matters.
  // Errors block outright; warnings (dangling refs, unreachable default-hidden
  // fields, …) list themselves in a confirm so publishing stays one decision.
  const handlePublish = (): void => {
    if (!onPublish) {
      return;
    }

    const { schema } = storeApi.getState();
    const result = validateSchema(schema, registries);
    const errors = result.issues.filter(issue => issue.severity === "error");

    if (errors.length > 0) {
      notify("error", `Schema 存在 ${errors.length} 个错误，已阻止发布`);
      return;
    }

    const warnings = result.issues.filter(issue => issue.severity === "warning");

    if (warnings.length === 0) {
      onPublish(schema);
      return;
    }

    confirmDialog(
      `存在 ${warnings.length} 条校验提示，仍要发布？`,
      <IssueList issues={warnings} />,
      {
        onOk: () => onPublish(schema),
        okType: "primary",
        detail: warnings.map(issue => formatIssueLine(issue)).join("\n")
      }
    );
  };

  const handleMoreSelect: NonNullable<DropdownMenuProps["onClick"]> = event => {
    switch (event.key) {
      case "import": {
        setIoMode("import");
        break;
      }

      case "export": {
        setIoMode("export");
        break;
      }

      case "clear": {
        handleClear();
        break;
      }
    }
  };

  return (
    <div css={toolbarCss} data-layout={layout}>
      <Brand brand={brand} />
      <div css={dividerCss} />

      <DeviceToggle
        compact={isCondensed}
        device={device}
        onChange={d => storeApi.getState().setDevice(d)}
      />

      <Tooltip title="撤销 (Cmd/Ctrl+Z)">
        <Button
          aria-label="撤销"
          css={toolbarIconButtonCss}
          disabled={pastLength === 0}
          icon={<EditorIcon name="undo-2" />}
          type="text"
          onClick={() => storeApi.getState().undo()}
        />
      </Tooltip>

      <Tooltip title="重做 (Cmd/Ctrl+Shift+Z)">
        <Button
          aria-label="重做"
          css={toolbarIconButtonCss}
          disabled={futureLength === 0}
          icon={<EditorIcon name="redo-2" />}
          type="text"
          onClick={() => storeApi.getState().redo()}
        />
      </Tooltip>

      <div css={togglePillsCss}>
        <PillToggle
          active={viewMode === "edit"}
          compact={isCondensed}
          icon="square-pen"
          label="编辑"
          onToggle={() => storeApi.getState().setViewMode("edit")}
        />

        <PillToggle
          active={viewMode === "preview"}
          compact={isCondensed}
          icon="eye"
          label="预览"
          onToggle={() => storeApi.getState().setViewMode("preview")}
        />

        <PillToggle
          active={viewMode === "json"}
          compact={isCondensed}
          icon="braces"
          label="JSON"
          onToggle={() => storeApi.getState().setViewMode("json")}
        />
      </div>

      <div css={summarySpacerCss}>
        {showSummary
          ? <FieldsSummary count={fieldsCount} />
          : null}
      </div>

      {isCondensed
        ? (
            <Dropdown
              menu={{ items: MORE_MENU_ITEMS, onClick: handleMoreSelect }}
              placement="bottomRight"
              trigger={["click"]}
            >
              <Button
                aria-label="更多操作"
                css={toolbarIconButtonCss}
                icon={<EditorIcon name="ellipsis" />}
                type="text"
              />
            </Dropdown>
          )
        : (
            <>
              <Button
                autoInsertSpace={false}
                css={toolbarActionButtonCss}
                icon={<EditorIcon name="upload" />}
                type="text"
                onClick={() => setIoMode("import")}
              >
                导入
              </Button>

              <Button
                autoInsertSpace={false}
                css={toolbarActionButtonCss}
                icon={<EditorIcon name="download" />}
                type="text"
                onClick={() => setIoMode("export")}
              >
                导出
              </Button>

              <Button
                danger
                autoInsertSpace={false}
                css={toolbarActionButtonCss}
                icon={<EditorIcon name="trash-2" />}
                type="text"
                onClick={handleClear}
              >
                清空
              </Button>
            </>
          )}

      {onPublish
        ? (
            <Button
              autoInsertSpace={false}
              css={primaryActionButtonCss}
              icon={<EditorIcon name="rocket" />}
              loading={publishLoading}
              type="primary"
              onClick={handlePublish}
            >
              {publishText ?? "发布"}
            </Button>
          )
        : null}

      <SchemaIoModal mode={ioMode} onClose={() => setIoMode(null)} />
    </div>
  );
}

function Brand({ brand }: { brand?: ToolbarBrand }): ReactElement {
  const layout = useEditorLayout();
  const name = brand?.name ?? "表单编辑器";

  return (
    <div css={brandCss}>
      <span css={brandMarkCss}>
        {brand?.icon ?? <EditorIcon name="clipboard-list" />}
      </span>

      {layout === "drawer"
        ? null
        : (
            <>
              <span css={brandNameCss}>{name}</span>
              {brand?.tag ? <span css={brandTagCss}>{brand.tag}</span> : null}
            </>
          )}
    </div>
  );
}

interface PillToggleProps {
  label: string;
  icon: DynamicIconName;
  active: boolean;
  compact?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

function PillToggle({
  active,
  compact,
  disabled,
  icon,
  label,
  onToggle
}: PillToggleProps): ReactElement {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={label}
      type="text"
      css={[
        togglePillCss,
        active && togglePillActiveCss,
        compact && togglePillCompactCss
      ]}
      onClick={onToggle}
    >
      <EditorIcon name={icon} />
      {compact ? null : <span>{label}</span>}
    </Button>
  );
}

interface FieldsSummaryProps {
  count: number;
}

// Field count only: the schema has no row layer (vertical order is just block
// order), so a "行" figure would describe nothing real.
function FieldsSummary({ count }: FieldsSummaryProps): ReactElement {
  return (
    <Tooltip title={`当前表单：${count} 个字段`}>
      <span css={summaryChipCss}>
        <EditorIcon name="layout-list" />
        {count}
        {" 字段"}
      </span>
    </Tooltip>
  );
}

interface DeviceToggleProps {
  device: EditorDeviceMode;
  compact?: boolean;
  onChange: (next: EditorDeviceMode) => void;
}

function DeviceToggle({
  compact,
  device,
  onChange
}: DeviceToggleProps): ReactElement {
  return (
    <div css={togglePillsCss}>
      <PillToggle
        active={device === "pc"}
        compact={compact}
        icon="monitor"
        label="PC"
        onToggle={() => onChange("pc")}
      />

      <PillToggle
        active={device === "mobile"}
        compact={compact}
        icon="smartphone"
        label="Mobile"
        onToggle={() => onChange("mobile")}
      />
    </div>
  );
}
