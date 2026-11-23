import type { ReactElement } from "react";

import type { FieldDefinition, FieldGroup } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars, Input, ScrollArea } from "@vef-framework-react/components";

import { EditorIcon } from "../../icons";
import { useFieldRegistry } from "../../store/engine-provider";
import { FIELD_GROUP_ORDER } from "../palette/field-groups";
import { PaletteGroup } from "../palette/palette-group";
import { panelBodyCss } from "../styles";

const searchWrapperCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "12px 14px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  flexShrink: 0
});

const hintCss = css({
  fontSize: 12,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.4
});

const emptyCss = css({
  padding: "56px 18px",
  textAlign: "center",
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorTextTertiary
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

export interface PaletteTabProps {
  keyword: string;
  onKeywordChange: (keyword: string) => void;
}

/**
 * The left sidebar's `组件` tab in docked layout: search bar + drag hint
 * pinned above the scrollable, collapsible field categories.
 */
export function PaletteTab({ keyword, onKeywordChange }: PaletteTabProps): ReactElement {
  const registry = useFieldRegistry();

  // Not memoized on `registry`: its identity is stable across register/unregister
  // (those re-renders come from useFieldRegistry's revision subscription, not a
  // new reference), so a memo keyed on it would serve a stale list after a
  // runtime field register/unregister.
  const trimmed = keyword.trim().toLowerCase();
  const allDefinitions = registry.paletteList();
  const filtered = trimmed
    ? allDefinitions.filter(d => d.config.name.toLowerCase().includes(trimmed)
      || d.config.type.toLowerCase().includes(trimmed)
      || (d.config.paletteId?.toLowerCase().includes(trimmed) ?? false))
    : allDefinitions;
  const groupedDefinitions = groupDefinitions(filtered);
  const isSearching = trimmed.length > 0;

  return (
    <>
      <div css={searchWrapperCss}>
        <Input
          allowClear
          aria-label="搜索组件"
          autoComplete="off"
          name="palette-search"
          placeholder="搜索组件…"
          prefix={<EditorIcon name="search" />}
          value={keyword}
          onChange={e => onKeywordChange(e.target.value)}
        />

        <div css={hintCss}>拖入画布 · 双击追加到选中容器或底部</div>
      </div>

      <ScrollArea css={panelBodyCss} scrollbars="vertical">
        {groupedDefinitions.length === 0
          ? <div css={emptyCss}>没有匹配的组件</div>
          : groupedDefinitions.map(([group, definitions]) => (
              <PaletteGroup
                key={group}
                definitions={definitions}
                forceOpen={isSearching ? true : undefined}
                group={group}
              />
            ))}
      </ScrollArea>
    </>
  );
}

/**
 * Narrow-layout (`drawer`) icon rail for the component palette: search and
 * group headers fold away while items keep their tooltip + drag + double-click.
 */
export function PaletteRail(): ReactElement {
  const registry = useFieldRegistry();
  const groupedDefinitions = groupDefinitions(registry.paletteList());

  return (
    <ScrollArea css={panelBodyCss} scrollbars="vertical">
      {groupedDefinitions.map(([group, definitions]) => (
        <PaletteGroup
          key={group}
          rail
          definitions={definitions}
          group={group}
        />
      ))}
    </ScrollArea>
  );
}
