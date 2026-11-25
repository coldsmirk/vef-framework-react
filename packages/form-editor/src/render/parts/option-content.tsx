import type { ReactElement, ReactNode } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { matchesOptionQuery } from "../../engine/options";

const stackCss = css({
  display: "inline-flex",
  flexDirection: "column",
  verticalAlign: "top",
  minWidth: 0,
  maxWidth: "100%",
  lineHeight: 1.4,
  paddingBlock: 3
});

const labelCss = css({
  color: "inherit",
  overflow: "hidden",
  textOverflow: "ellipsis"
});

const descriptionCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.35,
  whiteSpace: "normal",
  wordBreak: "break-word"
});

const inlineCss = css({
  display: "inline-flex",
  alignItems: "baseline",
  gap: 6,
  minWidth: 0,
  maxWidth: "100%"
});

const inlineDescriptionCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

/**
 * Render an option's label with an optional muted secondary description line
 * (or inline suffix for fixed-height surfaces like mobile wheel pickers).
 */
export function OptionItemContent({
  description,
  inline = false,
  label
}: {
  label: string;
  description?: string;
  inline?: boolean;
}): ReactElement {
  if (description === undefined || description.length === 0) {
    return <>{label}</>;
  }

  if (inline) {
    return (
      <span css={inlineCss}>
        <span>{label}</span>
        <span css={inlineDescriptionCss}>{description}</span>
      </span>
    );
  }

  return (
    <span css={stackCss}>
      <span css={labelCss}>{label}</span>
      <span css={descriptionCss}>{description}</span>
    </span>
  );
}

/**
 * antd `Select.optionRender` callback showing optional `description` as
 * secondary muted text underneath the option label.
 */
export function renderSelectOption(option: {
  label?: ReactNode;
  data?: { label?: unknown; description?: unknown };
}): ReactNode {
  const description = typeof option.data?.description === "string" ? option.data.description : undefined;

  if (description === undefined || description.length === 0) {
    return option.label;
  }

  const label = typeof option.data?.label === "string" ? option.data.label : String(option.label ?? "");

  return <OptionItemContent description={description} label={label} />;
}

/**
 * Search filter shared by flat `Select` and `MultiSelect` controls: matches the
 * typed query case-insensitively against the option's visible `label` or
 * `description` (never its storage `value`).
 */
export function filterOptionByLabelOrDescription(
  input: string,
  option?: object
): boolean {
  return matchesOptionQuery(input, option as { label?: unknown; description?: unknown } | undefined);
}
