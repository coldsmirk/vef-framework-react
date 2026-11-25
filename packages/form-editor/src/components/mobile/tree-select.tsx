import type { FC, ReactElement } from "react";

import type {
  FieldComponentProps,
  FieldOption,
  TreeMultiSelectField,
  TreeSelectField
} from "../../types";

import { css } from "@emotion/react";
import { globalCssVars, ScrollArea } from "@vef-framework-react/components";
import Popup from "antd-mobile/es/components/popup";
import { useMemo, useState } from "react";

import {
  hasOptionChildren,
  indexOptionsByValue
} from "../../engine/options";
import { EditorIcon } from "../../icons";
import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell } from "../../render/parts/field-shell";
import { useOptionTreeExpansion } from "../../render/parts/option-content";
import { OptionsStatus } from "../../render/parts/options-status";
import { resolveFieldPlaceholder } from "../../render/parts/placeholder";
import { PickerTrigger } from "./picker-trigger";
import { useMobileScopeContainer } from "./scope";

const EMPTY_VALUES: Array<string | number> = [];

const popupShellCss = css({
  display: "flex",
  flexDirection: "column",
  background: globalCssVars.colorBgElevated,
  color: globalCssVars.colorText
});

const popupHeaderCss = css({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "12px 16px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const popupTitleCss = css({
  flex: 1,
  minWidth: 0,
  textAlign: "center",
  fontWeight: 500,
  color: globalCssVars.colorText,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const popupActionCss = css({
  flexShrink: 0,
  minWidth: 40,
  padding: "2px 4px",
  border: "none",
  background: "transparent",
  font: "inherit",
  color: globalCssVars.colorTextSecondary,
  cursor: "pointer"
});

const popupConfirmCss = css({
  color: globalCssVars.colorPrimary,
  fontWeight: 500,
  textAlign: "right"
});

const popupSpacerCss = css({
  flexShrink: 0,
  minWidth: 40
});

const searchBarCss = css({
  flexShrink: 0,
  padding: "8px 12px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const searchFieldCss = css({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorFillQuaternary,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,

  "&:focus-within": {
    borderColor: globalCssVars.colorPrimary
  }
});

const searchIconCss = css({
  display: "inline-flex",
  flexShrink: 0,
  color: globalCssVars.colorTextTertiary,

  "& > svg": {
    width: 14,
    height: 14
  }
});

const searchInputCss = css({
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  font: "inherit",
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorText,

  "&::placeholder": {
    color: globalCssVars.colorTextPlaceholder
  }
});

const searchClearCss = css({
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  border: "none",
  background: "transparent",
  color: globalCssVars.colorTextTertiary,
  cursor: "pointer",

  "& > svg": {
    width: 14,
    height: 14
  }
});

const scrollViewportStyle = { maxHeight: "55vh" } as const;

const treeListCss = css({
  display: "flex",
  flexDirection: "column",
  padding: "4px 0"
});

const treeRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 4,
  minHeight: 44,
  paddingRight: 16,
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,

  "&:last-of-type": {
    borderBottom: "none"
  }
});

const treeRowSelectedCss = css({
  background: globalCssVars.colorPrimaryBg
});

const expandButtonCss = css({
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  padding: 0,
  border: "none",
  borderRadius: globalCssVars.borderRadiusSm,
  background: "transparent",
  color: globalCssVars.colorTextSecondary,
  cursor: "pointer",

  "& > svg": {
    width: 16,
    height: 16
  }
});

const expandSpacerCss = css({
  flexShrink: 0,
  width: 28,
  height: 28
});

const selectButtonCss = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "8px 0",
  border: "none",
  background: "transparent",
  textAlign: "left",
  font: "inherit",
  color: globalCssVars.colorText,
  cursor: "pointer",

  "&:disabled": {
    color: globalCssVars.colorTextDisabled,
    cursor: "not-allowed"
  }
});

const rowMainCss = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "flex-start",
  gap: 8
});

const rowTextCss = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 2
});

const rowLabelCss = css({
  fontSize: globalCssVars.fontSize,
  lineHeight: 1.4,
  color: "inherit",
  wordBreak: "break-word"
});

const rowDescriptionCss = css({
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.35,
  color: globalCssVars.colorTextTertiary,
  wordBreak: "break-word"
});

const checkboxCss = css({
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  marginTop: 2,
  borderRadius: globalCssVars.borderRadiusSm,
  border: `1.5px solid ${globalCssVars.colorBorder}`,
  background: globalCssVars.colorBgContainer,
  color: globalCssVars.colorTextLightSolid,
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1
});

const checkboxCheckedCss = css({
  borderColor: globalCssVars.colorPrimary,
  background: globalCssVars.colorPrimary
});

const checkboxDisabledCss = css({
  opacity: 0.45
});

const singleCheckCss = css({
  flexShrink: 0,
  color: globalCssVars.colorPrimary,
  fontSize: globalCssVars.fontSize,
  fontWeight: 600
});

const popupStatusCss = css({
  padding: "24px 16px",
  textAlign: "center",
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

interface VisibleTreeRow {
  option: FieldOption;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

function flattenVisibleTreeRows(
  options: readonly FieldOption[],
  expandedKeys: ReadonlySet<string | number>,
  depth = 0
): VisibleTreeRow[] {
  const rows: VisibleTreeRow[] = [];

  for (const option of options) {
    const hasChildren = hasOptionChildren(option);
    const expanded = hasChildren && expandedKeys.has(option.value);

    rows.push({
      option,
      depth,
      hasChildren,
      expanded
    });

    if (expanded) {
      rows.push(...flattenVisibleTreeRows(option.children!, expandedKeys, depth + 1));
    }
  }

  return rows;
}

interface MobileTreePickerProps {
  disabled?: boolean;
  domId: string;
  error: boolean;
  errors?: string[];
  helperText?: string;
  label: string;
  labelPosition?: "top" | "left" | "right";
  leafOnly: boolean;
  loading: boolean;
  multiple: boolean;
  options: readonly FieldOption[];
  placeholder: string;
  required?: boolean;
  allowClear?: boolean;
  showSearch?: boolean;
  selectedValues: ReadonlyArray<string | number>;
  onCommitSingle?: (value: string | number) => void;
  onCommitMulti?: (values: Array<string | number>) => void;
}

/**
 * Shared mobile tree picker for `tree-select` and `tree-multi-select`:
 * renders a `Popup` contained inside the mobile phone shell with a pinned
 * header, optional pinned search input, and a single scrollable tree list.
 * Single mode commits immediately on row tap; multi mode maintains a strict
 * non-cascading draft committed on `确定`.
 */
function MobileTreePicker({
  allowClear,
  disabled,
  domId,
  error,
  errors,
  helperText,
  label,
  labelPosition,
  leafOnly,
  loading,
  multiple,
  onCommitMulti,
  onCommitSingle,
  options,
  placeholder,
  required,
  selectedValues,
  showSearch
}: MobileTreePickerProps): ReactElement {
  const getContainer = useMobileScopeContainer();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<Array<string | number>>(EMPTY_VALUES);

  const {
    expandedKeySet,
    isSearching,
    onOpenChange,
    searchValue,
    setSearchValue,
    toggleExpandedKey,
    visibleOptions
  } = useOptionTreeExpansion(options, selectedValues);

  const optionByValue = useMemo(() => indexOptionsByValue(options), [options]);

  // Missing values fall back to their raw stringified value, mirroring PC
  // TreeSelect and MobileSelectInput so retired or in-flight values remain
  // visible and clearable.
  const display = selectedValues.length > 0
    ? selectedValues.map(item => optionByValue.get(item)?.label ?? String(item)).join("、")
    : "";
  const hasError = (errors?.length ?? 0) > 0 || error;

  let triggerPlaceholder = placeholder;

  if (loading) {
    triggerPlaceholder = "加载中…";
  } else if (error && options.length === 0) {
    triggerPlaceholder = "选项加载失败";
  }

  const visibleRows = useMemo(
    () => flattenVisibleTreeRows(visibleOptions, expandedKeySet),
    [expandedKeySet, visibleOptions]
  );

  const selectedSet = useMemo(
    () => new Set<string | number>(multiple ? draft : selectedValues),
    [draft, multiple, selectedValues]
  );

  const handleOpen = (): void => {
    onOpenChange(true);

    if (multiple) {
      setDraft([...selectedValues]);
    }

    setVisible(true);
  };

  const handleClose = (): void => {
    setVisible(false);
    onOpenChange(false);
  };

  const handleRowSelect = (row: VisibleTreeRow): void => {
    const { hasChildren, option } = row;

    if (leafOnly && hasChildren) {
      toggleExpandedKey(option.value);
      return;
    }

    if (option.disabled === true) {
      return;
    }

    if (!multiple) {
      onCommitSingle?.(option.value);
      handleClose();
      return;
    }

    setDraft(prev => prev.includes(option.value)
      ? prev.filter(item => item !== option.value)
      : [...prev, option.value]);
  };

  const handleConfirm = (): void => {
    onCommitMulti?.(draft.length > 0 ? [...draft] : []);
    handleClose();
  };

  const handleClear = (): void => {
    if (multiple) {
      onCommitMulti?.([]);
    } else {
      onCommitSingle?.("");
    }
  };

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={helperText}
      label={label}
      labelPosition={labelPosition}
      required={required}
    >
      <PickerTrigger
        disabled={disabled}
        display={display}
        domId={domId}
        hasError={hasError}
        placeholder={triggerPlaceholder}
        trailing={<EditorIcon name="chevron-down" />}
        onClear={allowClear ? handleClear : undefined}
        onOpen={handleOpen}
      />

      <Popup
        closeOnMaskClick
        destroyOnClose
        getContainer={getContainer}
        position="bottom"
        visible={visible}
        onClose={handleClose}
      >
        <div css={popupShellCss}>
          <div css={popupHeaderCss}>
            <button css={popupActionCss} type="button" onClick={handleClose}>取消</button>
            <span css={popupTitleCss}>{label}</span>

            {multiple
              ? <button css={[popupActionCss, popupConfirmCss]} type="button" onClick={handleConfirm}>确定</button>
              : <span aria-hidden css={popupSpacerCss} />}
          </div>

          {showSearch === true
            ? (
                <div css={searchBarCss}>
                  <div css={searchFieldCss}>
                    <span aria-hidden css={searchIconCss}>
                      <EditorIcon name="search" />
                    </span>

                    <input
                      aria-label="搜索选项"
                      css={searchInputCss}
                      placeholder="搜索选项"
                      type="text"
                      value={searchValue}
                      onChange={event => setSearchValue(event.target.value)}
                    />

                    {searchValue.length > 0
                      ? (
                          <button
                            aria-label="清空搜索"
                            css={searchClearCss}
                            type="button"
                            onClick={() => setSearchValue("")}
                          >
                            <EditorIcon name="circle-x" />
                          </button>
                        )
                      : null}
                  </div>
                </div>
              )
            : null}

          <ScrollArea scrollbars="vertical" viewportStyle={scrollViewportStyle}>
            {visibleRows.length > 0
              ? (
                  <div css={treeListCss} role="tree">
                    {visibleRows.map(row => {
                      const {
                        depth,
                        expanded,
                        hasChildren,
                        option
                      } = row;
                      const isSelected = selectedSet.has(option.value);
                      const isBlockedByLeafOnly = leafOnly && hasChildren;
                      const isOptionDisabled = option.disabled === true;
                      const isSelectable = !isBlockedByLeafOnly && !isOptionDisabled;

                      return (
                        <div
                          key={String(option.value)}
                          css={[treeRowCss, isSelected && treeRowSelectedCss]}
                          style={{ paddingLeft: 12 + depth * 18 }}
                        >
                          {hasChildren
                            ? (
                                <button
                                  aria-expanded={expanded}
                                  aria-label={expanded ? `收起 ${option.label}` : `展开 ${option.label}`}
                                  css={expandButtonCss}
                                  type="button"
                                  onClick={() => toggleExpandedKey(option.value)}
                                >
                                  <EditorIcon name={expanded ? "chevron-down" : "chevron-right"} />
                                </button>
                              )
                            : <span aria-hidden css={expandSpacerCss} />}

                          <button
                            aria-disabled={isOptionDisabled || undefined}
                            aria-selected={isSelectable ? isSelected : undefined}
                            css={selectButtonCss}
                            disabled={isOptionDisabled && !isBlockedByLeafOnly}
                            role="treeitem"
                            type="button"
                            onClick={() => handleRowSelect(row)}
                          >
                            <span css={rowMainCss}>
                              {multiple && !isBlockedByLeafOnly
                                ? (
                                    <span
                                      aria-hidden
                                      css={[
                                        checkboxCss,
                                        isSelected && checkboxCheckedCss,
                                        isOptionDisabled && checkboxDisabledCss
                                      ]}
                                    >
                                      {isSelected ? "✓" : null}
                                    </span>
                                  )
                                : null}

                              <span css={rowTextCss}>
                                <span css={rowLabelCss}>{option.label}</span>

                                {option.description !== undefined && option.description.length > 0
                                  ? <span css={rowDescriptionCss}>{option.description}</span>
                                  : null}
                              </span>
                            </span>

                            {!multiple && isSelected ? <span aria-hidden css={singleCheckCss}>✓</span> : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              : isSearching && options.length > 0
                ? <div css={popupStatusCss}>无匹配项</div>
                : (
                    <div css={popupStatusCss}>
                      <OptionsStatus error={error} loading={loading} />
                    </div>
                  )}
          </ScrollArea>
        </div>
      </Popup>
    </FieldShell>
  );
}

/**
 * Mobile counterpart of `tree-select-field`. Tapping any selectable node
 * commits its scalar value and closes the popup; tapping a non-leaf node under
 * `leafOnly` toggles expansion instead.
 */
export const MobileTreeSelectInput: FC<FieldComponentProps<TreeSelectField, string | number | undefined>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}) => {
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);
  const selectedValues = useMemo<Array<string | number>>(
    () => value !== "" && value !== null && value !== undefined ? [value] : EMPTY_VALUES,
    [value]
  );

  return (
    <MobileTreePicker
      allowClear={field.allowClear}
      disabled={disabled}
      domId={domId}
      error={error}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "树形选择"}
      labelPosition={field.labelPosition ?? labelPosition}
      leafOnly={field.leafOnly === true}
      loading={loading}
      multiple={false}
      options={options}
      placeholder={resolveFieldPlaceholder(field)}
      required={required ?? field.validate?.required}
      selectedValues={selectedValues}
      showSearch={field.showSearch}
      onCommitSingle={next => onChange(next)}
    />
  );
};

/**
 * Mobile counterpart of `tree-multi-select-field`. Strict non-cascading
 * selection committed on `确定`; clearing commits `[]`.
 */
export const MobileTreeMultiSelectInput: FC<FieldComponentProps<TreeMultiSelectField, Array<string | number>>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}) => {
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);
  const selectedValues = Array.isArray(value) ? value : EMPTY_VALUES;

  return (
    <MobileTreePicker
      multiple
      allowClear={field.allowClear}
      disabled={disabled}
      domId={domId}
      error={error}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "树形多选"}
      labelPosition={field.labelPosition ?? labelPosition}
      leafOnly={field.leafOnly === true}
      loading={loading}
      options={options}
      placeholder={resolveFieldPlaceholder(field)}
      required={required ?? field.validate?.required}
      selectedValues={selectedValues}
      showSearch={field.showSearch}
      onCommitMulti={next => onChange(next)}
    />
  );
};
