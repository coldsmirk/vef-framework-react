import type { ReactNode, RefObject } from "react";

import type { NodeKind } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { getSpecification } from "../../specifications";
import { AccentIconBadge } from "../accent-icon-badge";
import { NodeShell } from "./node-shell";

interface BaseNodeProps {
  type: NodeKind;
  label: string;
  description?: string;
  selected?: boolean;
  children?: ReactNode;
}

const bodyStyle = css({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0
});

const headerStyle = css({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px"
});

const labelStyle = css({
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontWeight: 500,
  fontSize: 13,
  lineHeight: "24px"
});

const descriptionStyle = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.4,
  padding: "0 14px 6px 46px",
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  wordBreak: "break-word"
});

export function BaseNode({
  ref,
  type,
  label,
  description,
  selected,
  children
}: BaseNodeProps & { ref?: RefObject<HTMLDivElement | null> }) {
  const spec = getSpecification(type);
  const Icon = spec.icon;

  return (
    <NodeShell ref={ref} selected={selected} type={type}>
      <div css={bodyStyle}>
        <div css={headerStyle}>
          <AccentIconBadge color={spec.color} variant={spec.badgeVariant}>
            {Icon ? <Icon height={14} width={14} /> : null}
          </AccentIconBadge>

          <div css={labelStyle}>{label}</div>
        </div>

        {description && <div css={descriptionStyle}>{description}</div>}
        {children}
      </div>
    </NodeShell>
  );
}
