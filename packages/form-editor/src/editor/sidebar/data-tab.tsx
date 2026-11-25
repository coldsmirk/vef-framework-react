import type { ReactElement } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { useContextSources } from "../context-sources";
import { FormDataSourcesPanel } from "../properties/form-data-sources-panel";
import { FormVariablesPanel } from "../properties/form-variables-panel";
import { SystemVariablesPanel } from "../properties/system-variables-panel";

const bodyCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 20,
  padding: "14px 12px 24px",
  // Size from the panel, not the content — mirrors the right properties panel
  // so long names or copyable paths never widen the vertical scroll track past
  // the uniform 296px sidebar.
  contain: "inline-size"
});

const sectionCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 10
});

const sectionTitleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText,
  paddingBottom: 6,
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const subSectionTitleCss = css({
  marginBottom: 8,
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 600,
  color: globalCssVars.colorTextSecondary
});

const followingSubSectionCss = css({
  marginTop: 12
});

/**
 * The left sidebar's `数据` tab: form-global data sources first, then variables
 * (the form's own writable variables followed by read-only host system
 * variables when declared). Both lists edit through modals, so the tab stays a
 * compact index.
 */
export function DataTab(): ReactElement {
  const hasSystemVariables = useContextSources().length > 0;

  return (
    <div css={bodyCss}>
      <section css={sectionCss}>
        <FormDataSourcesPanel />
      </section>

      <section css={sectionCss}>
        {hasSystemVariables
          ? (
              <>
                <div css={sectionTitleCss}>变量</div>
                <FormVariablesPanel title="表单变量" titleLevel="sub" />

                <div css={followingSubSectionCss}>
                  <div css={subSectionTitleCss}>系统变量</div>
                  <SystemVariablesPanel />
                </div>
              </>
            )
          : <FormVariablesPanel title="变量" />}
      </section>
    </div>
  );
}
