import type { ReactElement } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { useContextSources } from "../context-sources";
import { FormDataSourcesPanel } from "../properties/form-data-sources-panel";
import { FormVariablesPanel } from "../properties/form-variables-panel";
import { SystemVariablesPanel } from "../properties/system-variables-panel";

const bodyCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 22,
  padding: "16px 16px 24px",
  // Size from the panel, not the content — mirrors the right properties panel
  // so CodeMirror expressions inside remote request params never widen the
  // vertical scroll track past the sidebar.
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
  marginTop: 14
});

/**
 * The left sidebar's `数据` tab: form-global data sources first, then
 * variables (the form's own writable variables followed by read-only host
 * system variables when declared). Subscribes only to `dataSources` and
 * `variables` so ordinary field edits never re-render this tab.
 */
export function DataTab(): ReactElement {
  const dataSources = useFormEditorStore(s => s.schema.dataSources);
  const variables = useFormEditorStore(s => s.schema.variables);
  const storeApi = useFormEditorStoreApi();
  const hasSystemVariables = useContextSources().length > 0;

  const formVariables = (
    <FormVariablesPanel
      variables={variables ?? []}
      onChange={next => storeApi.getState().patchSchema({ variables: next.length > 0 ? next : undefined })}
    />
  );

  return (
    <div css={bodyCss}>
      <section css={sectionCss}>
        <div css={sectionTitleCss}>数据源</div>

        <FormDataSourcesPanel
          dataSources={dataSources ?? []}
          onChange={next => storeApi.getState().patchSchema({ dataSources: next.length > 0 ? next : undefined })}
        />
      </section>

      <section css={sectionCss}>
        <div css={sectionTitleCss}>变量</div>

        {hasSystemVariables
          ? (
              <>
                <div>
                  <div css={subSectionTitleCss}>表单变量</div>
                  {formVariables}
                </div>

                <div css={followingSubSectionCss}>
                  <div css={subSectionTitleCss}>系统变量</div>
                  <SystemVariablesPanel />
                </div>
              </>
            )
          : formVariables}
      </section>
    </div>
  );
}
