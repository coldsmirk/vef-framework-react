import type { ReactNode } from "react";

import { css } from "@emotion/react";
import { Flex, globalCssVars, Stack, Text } from "@vef-framework-react/components";

const sectionCss = css({
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadiusLg,
  background: globalCssVars.colorBgContainer,
  overflow: "hidden"
});

const headerCss = css({
  padding: "10px 16px",
  background: globalCssVars.colorFillAlter
});

const bodyCss = css({
  padding: 16,
  borderTop: `1px solid ${globalCssVars.colorBorderSecondary}`
});

export interface FormSectionProps {
  /**
   * Section name shown in the header.
   */
  title: ReactNode;
  /**
   * One-line explanation of what the section configures, under the title.
   */
  description?: ReactNode;
  /**
   * Right slot of the header — typically the switch enabling the section.
   */
  extra?: ReactNode;
  children?: ReactNode;
}

/**
 * A titled group of form fields. Optional capabilities put their enable switch
 * in `extra` and render children only while enabled, so the header row alone
 * tells which capabilities a record has.
 */
export function FormSection({
  title,
  description,
  extra,
  children
}: FormSectionProps) {
  return (
    <section css={sectionCss}>
      <Flex align="center" css={headerCss} gap="middle" justify="space-between">
        <Stack gap={2}>
          <Text strong>{title}</Text>
          {description ? <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">{description}</Text> : null}
        </Stack>

        {extra}
      </Flex>

      {children ? <div css={bodyCss}>{children}</div> : null}
    </section>
  );
}
