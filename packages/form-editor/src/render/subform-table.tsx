import type { CSSProperties, ReactElement, ReactNode } from "react";

import type { FixedSubformRows, KeyedFormField, SubformNode, TableSubform } from "../types";
import type { FormRendererProps } from "./form-renderer";

import { css } from "@emotion/react";
import { Flex, globalCssVars, Text } from "@vef-framework-react/components";

import { isValidatableField } from "../engine/keys";
import { fixedRowHeaderTitle } from "../engine/schema/subform";

const DEFAULT_FIXED_HEADER_MIN_WIDTH = 180;
const REMOVE_COLUMN_WIDTH = 44;

const tableScrollCss = css({
  width: "100%",
  overflowX: "auto",
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgContainer
});

const tableCss = css({
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "auto",

  "& tbody tr:not(:last-child) > td": {
    borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
  }
});

const DENSITY_CSS: Record<NonNullable<TableSubform["size"]>, ReturnType<typeof css>> = {
  small: css({
    "--fe-th-pad": "6px 8px",
    "--fe-td-top": "8px",
    "--fe-td-px": "8px"
  }),
  middle: css({
    "--fe-th-pad": "9px 10px",
    "--fe-td-top": "10px",
    "--fe-td-px": "10px"
  }),
  large: css({
    "--fe-th-pad": "12px 12px",
    "--fe-td-top": "14px",
    "--fe-td-px": "12px"
  })
};

const headerCellCss = css({
  padding: "var(--fe-th-pad)",
  background: globalCssVars.colorFillQuaternary,
  color: globalCssVars.colorTextHeading,
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 600,
  lineHeight: 1.5,
  textAlign: "left",
  whiteSpace: "nowrap",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,

  "&:not(:last-child)": {
    borderRight: `1px solid ${globalCssVars.colorBorderSecondary}`
  }
});

const columnHeaderCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 4
});

const requiredMarkCss = css({
  flexShrink: 0,
  color: globalCssVars.colorErrorText,
  fontWeight: 600
});

export const tableDataCellCss = css({
  verticalAlign: "top",
  padding: "var(--fe-td-top) var(--fe-td-px) 0",

  "&:not(:last-child)": {
    borderRight: `1px solid ${globalCssVars.colorBorderSecondary}`
  }
});

export const tableFixedHeaderCellCss = css({
  verticalAlign: "top",
  padding: "calc(var(--fe-td-top) + 5px) var(--fe-td-px) 18px",
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorText,
  lineHeight: 1.5,
  wordBreak: "break-word",

  "&:not(:last-child)": {
    borderRight: `1px solid ${globalCssVars.colorBorderSecondary}`
  }
});

export const tableRemoveCellCss = css({
  verticalAlign: "top",
  width: REMOVE_COLUMN_WIDTH,
  minWidth: REMOVE_COLUMN_WIDTH,
  padding: "var(--fe-td-top) 6px 18px",
  textAlign: "center"
});

export const tableRowHeadingCss = css({
  marginBottom: 6
});

export const tableCellExtraCss = css({
  paddingBottom: 8
});

const emptyRowCss = css({
  padding: "20px 12px",
  textAlign: "center",
  color: globalCssVars.colorTextTertiary,
  fontSize: globalCssVars.fontSizeSm
});

const removeColStyle: CSSProperties = {
  width: REMOVE_COLUMN_WIDTH,
  minWidth: REMOVE_COLUMN_WIDTH
};

function defaultColumnMinWidth(field: KeyedFormField): number {
  switch (field.type) {
    case "switch": {
      return 72;
    }

    case "number": {
      return 120;
    }

    case "radio": {
      return 140;
    }

    case "checkbox-group": {
      return 152;
    }

    case "textarea": {
      return 180;
    }

    case "daterange": {
      return 220;
    }

    default: {
      return 144;
    }
  }
}

export function tableColumnStyle(field: KeyedFormField): CSSProperties {
  if (typeof field.columnWidth === "number") {
    return {
      width: field.columnWidth,
      minWidth: field.columnWidth
    };
  }

  return { minWidth: defaultColumnMinWidth(field) };
}

export function fixedHeaderColumnStyle(headerWidth: number | undefined): CSSProperties {
  if (typeof headerWidth === "number") {
    return {
      width: headerWidth,
      minWidth: headerWidth
    };
  }

  return { minWidth: DEFAULT_FIXED_HEADER_MIN_WIDTH };
}

/**
 * Globally-unique DOM id for a column header's text span, referenced by each
 * cell control's `aria-labelledby` so inputs keep an accessible name matching
 * the column title without duplicating label text inside every row.
 */
export function tableColumnHeaderId(
  domIdPrefix: string,
  namePrefix: string,
  subformKey: string,
  fieldId: string
): string {
  return `${domIdPrefix}col-${namePrefix}${subformKey}-${fieldId}`;
}

export interface SubformTableFrameProps {
  canRemove: boolean;
  children: ReactNode;
  columns: readonly KeyedFormField[];
  domIdPrefix: string;
  empty: boolean;
  fixed?: FixedSubformRows;
  namePrefix: string;
  renderFieldExtra?: FormRendererProps["renderFieldExtra"];
  subform: TableSubform;
}

/**
 * Semantic desktop table shell for `variant: "table"` subforms: horizontal
 * scroll wrapper, explicit column sizing (`headerWidth` / `columnWidth`),
 * header row with required markers and `renderFieldExtra` column-header slots,
 * optional trailing delete column (only when dynamic rows can be removed), and
 * an empty-state row when a dynamic table has zero rows.
 */
export function SubformTableFrame({
  canRemove,
  children,
  columns,
  domIdPrefix,
  empty,
  fixed,
  namePrefix,
  renderFieldExtra,
  subform
}: SubformTableFrameProps): ReactElement {
  const size = subform.size ?? "middle";
  const totalColumns = columns.length + (fixed ? 1 : 0) + (canRemove ? 1 : 0);

  return (
    <div css={tableScrollCss}>
      <table css={[tableCss, DENSITY_CSS[size]]}>
        <colgroup>
          {fixed ? <col style={fixedHeaderColumnStyle(fixed.headerWidth)} /> : null}
          {columns.map(field => <col key={field.id} style={tableColumnStyle(field)} />)}
          {canRemove ? <col style={removeColStyle} /> : null}
        </colgroup>

        <thead>
          <tr>
            {fixed
              ? (
                  <th css={headerCellCss} scope="col" style={fixedHeaderColumnStyle(fixed.headerWidth)}>
                    {fixedRowHeaderTitle(fixed)}
                  </th>
                )
              : null}

            {columns.map(field => {
              const required = isValidatableField(field) && field.validate?.required === true;
              const headerId = tableColumnHeaderId(domIdPrefix, namePrefix, subform.key, field.id);
              const extra = renderFieldExtra?.({
                key: subform.key,
                column: field.key,
                type: field.type,
                label: field.label
              });

              return (
                <th key={field.id} css={headerCellCss} scope="col" style={tableColumnStyle(field)}>
                  <span css={columnHeaderCss}>
                    <span id={headerId}>{field.label ?? field.key}</span>
                    {required ? <span aria-hidden="true" css={requiredMarkCss}>*</span> : null}
                    {extra}
                  </span>
                </th>
              );
            })}

            {canRemove ? <th aria-label="操作" css={[headerCellCss, tableRemoveCellCss]} scope="col" /> : null}
          </tr>
        </thead>

        <tbody>
          {empty
            ? (
                <tr>
                  <td colSpan={Math.max(totalColumns, 1)} css={emptyRowCss}>
                    暂无数据
                  </td>
                </tr>
              )
            : children}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Optional per-row heading rendered when `renderFieldExtra` produces content
 * for a subform row slot (`{ key, type: "subform", label, row }`). Shared by
 * both stack and table layouts.
 */
export function subformRowHeading(
  subform: SubformNode,
  row: number,
  render?: FormRendererProps["renderFieldExtra"]
): ReactElement | null {
  const extra = render?.({
    key: subform.key,
    type: subform.type,
    label: subform.label,
    row
  });

  return (extra === null || extra === undefined)
    ? null
    : (
        <Flex align="center" gap={4} wrap="wrap">
          <Text strong>{`第 ${row + 1} 行`}</Text>
          {extra}
        </Flex>
      );
}
