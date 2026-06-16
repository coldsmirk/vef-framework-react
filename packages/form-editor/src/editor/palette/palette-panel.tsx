import type { ReactElement } from "react";

import type { FieldDefinition, FieldGroup } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars, Input, ScrollArea } from "@vef-framework-react/components";
import { useState } from "react";

import { EditorIcon } from "../../icons";
import { useFieldRegistry } from "../../store/engine-provider";
import { isPaletteVisible, useFormEditorStore } from "../../store/form-store";
import { useEditorLayout } from "../editor-layout-context";
import {
  paletteDockCss,
  panelBodyCss,
  panelHeaderCss
} from "../styles";
import { FIELD_GROUP_ORDER } from "./field-groups";
import { PaletteGroup } from "./palette-group";

const headerCss = css(panelHeaderCss, {
  flexDirection: "column",
  alignItems: "stretch",
  gap: 6,
  padding: "16px 18px 14px"
});

const headerRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText
});

const railHeaderCss = css(panelHeaderCss, {
  justifyContent: "center",
  padding: "14px 0"
});

const headerHintCss = css({
  fontSize: 12,
  color: globalCssVars.colorTextTertiary,
  letterSpacing: 0,
  paddingLeft: 38,
  lineHeight: 1.4
});

const searchWrapperCss = css({
  padding: "12px 18px 14px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const emptyCss = css({
  padding: "56px 18px",
  textAlign: "center",
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorTextTertiary
});

const titleIconCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 6,
  background: globalCssVars.colorFillQuaternary,
  color: globalCssVars.colorTextSecondary,

  "& > svg": {
    width: 16,
    height: 16
  }
});

/**
 * Group registered field definitions by their `config.group`. The result
 * is a tuple list preserving `FIELD_GROUP_ORDER` so the panel renders
 * categories in the same order across renders.
 */
function groupDefinitions(
  definitions: FieldDefinition[]
): Array<[FieldGroup, FieldDefinition[]]> {
  const buckets = new Map<FieldGroup, FieldDefinition[]>();

  for (const definition of definitions) {
    const { group } = definition.config;
    const bucket = buckets.get(group) ?? [];
    bucket.push(definition);
    buckets.set(group, bucket);
  }

  return FIELD_GROUP_ORDER
    .filter(group => buckets.has(group))
    .map(group => [group, buckets.get(group) as FieldDefinition[]]);
}

/**
 * Docked component palette. It is the editor's persistent "materials"
 * workbench: visible in edit mode and hidden during preview mode.
 *
 * Composition:
 * - header: "组件库" title
 * - search row: filters by name or type
 * - body: collapsible category groups, 2-column item grid each
 * - footer: drag/double-click hint
 *
 * Search is local state and survives preview-mode round trips because the
 * panel stays mounted while hidden. When a search keyword is active every
 * visible group is forced open so the user does not have to expand each
 * section to see matches.
 */
export function PalettePanel(): ReactElement {
  const visible = useFormEditorStore(isPaletteVisible);
  const registry = useFieldRegistry();
  const layout = useEditorLayout();

  const [keyword, setKeyword] = useState("");

  // Not memoized on `registry`: its identity is stable across register/unregister
  // (those re-renders come from useFieldRegistry's revision subscription, not a
  // new reference), so a memo keyed on it would serve a stale list after a
  // runtime field register/unregister. list() + a string filter over a few dozen
  // field types is cheap, so recompute each render and always reflect the
  // current registry.
  const trimmed = keyword.trim().toLowerCase();
  const allDefinitions = registry.list();
  const filtered = trimmed
    ? allDefinitions.filter(d => d.config.name.toLowerCase().includes(trimmed)
      || d.config.type.toLowerCase().includes(trimmed))
    : allDefinitions;
  const groupedDefinitions: Array<[FieldGroup, FieldDefinition[]]> = groupDefinitions(filtered);

  const isSearching = keyword.trim().length > 0;
  // The drawer layout collapses the palette into an icon rail: search and
  // group headers fold away, items keep their tooltip + drag + double-click.
  const rail = layout === "drawer";

  return (
    <aside aria-label="组件库" css={paletteDockCss} data-layout={layout} hidden={!visible}>
      <div css={rail ? railHeaderCss : headerCss}>
        <div css={headerRowCss}>
          <span css={titleIconCss} title={rail ? "组件库" : undefined}>
            <EditorIcon name="layout-grid" />
          </span>

          {rail ? null : <span>组件库</span>}
        </div>

        {rail ? null : <div css={headerHintCss}>拖入画布 · 双击追加到选中容器或底部</div>}
      </div>

      {rail
        ? null
        : (
            <div css={searchWrapperCss}>
              <Input
                allowClear
                aria-label="搜索组件"
                autoComplete="off"
                name="palette-search"
                placeholder="搜索组件…"
                prefix={<EditorIcon name="search" />}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>
          )}

      <ScrollArea css={panelBodyCss} scrollbars="vertical">
        {groupedDefinitions.length === 0
          ? <div css={emptyCss}>没有匹配的组件</div>
          : groupedDefinitions.map(([group, definitions]) => (
              <PaletteGroup
                key={group}
                definitions={definitions}
                forceOpen={isSearching ? true : undefined}
                group={group}
                rail={rail}
              />
            ))}
      </ScrollArea>
    </aside>
  );
}
