import type { DynamicIconName } from "@vef-framework-react/components";
import type { ComponentProps } from "react";

import { css } from "@emotion/react";
import { DynamicIcon, globalCssVars, Icon, Text } from "@vef-framework-react/components";
import { MenuIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { KeyboardReturnIcon } from "./keyboard-return-icon";

interface SearchResultItemProps extends ComponentProps<"div"> {
  active?: boolean;
  icon?: string;
  label: string;
}

const itemStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  columnGap: globalCssVars.spacingMd,
  padding: globalCssVars.spacingMd,
  borderRadius: globalCssVars.borderRadiusLg,
  backgroundColor: globalCssVars.colorFillTertiary,
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: globalCssVars.motionDurationMid,
  transitionTimingFunction: "ease",
  "& .vef-typography": {
    transitionProperty: "color",
    transitionDuration: globalCssVars.motionDurationMid,
    transitionTimingFunction: "ease"
  }
});

const activeItemStyle = css({
  backgroundColor: globalCssVars.colorPrimary,
  color: globalCssVars.colorTextLightSolid,
  "& .vef-typography": {
    color: globalCssVars.colorTextLightSolid
  }
});

const titleStyle = css({
  display: "flex",
  alignItems: "center",
  columnGap: globalCssVars.spacingXs,
  flex: "auto",
  minWidth: 0
});

export function SearchResultItem({
  active,
  icon,
  label,
  ...props
}: SearchResultItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [active]);

  return (
    <div
      ref={ref}
      css={[itemStyle, active && activeItemStyle]}
      {...props}
    >
      <span css={titleStyle}>
        {icon
          ? <DynamicIcon name={icon as DynamicIconName} />
          : <Icon component={MenuIcon} />}

        <Text ellipsis>{label}</Text>
      </span>

      <Icon component={KeyboardReturnIcon} />
    </div>
  );
}
