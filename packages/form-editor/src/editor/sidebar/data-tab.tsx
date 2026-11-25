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
 * The left sidebar's `数据` tab: compact list of form-global data sources
 * first, then variables (the form's own writable variables followed by
 * read-only host system variables when declared). Both data sources and form
 * variables commit discrete edits through modals (non-coalescing undo steps).
 */
export function DataTab(): ReactElement {
  const dataSources = useFormEditorStore(s => s.schema.dataSources);
  const variables = useFormEditorStore(s => s.schema.variables);
  const storeApi = useFormEditorStoreApi();
  const hasSystemVariables = useContextSources().length > 0;

  const handleDataSourcesChange = (next: NonNullable<typeof dataSources>): void => {
    storeApi.getState().patchSchema(
      { dataSources: next.length > 0 ? next : undefined },
      { coalesce: false }
    );
  };

  const handleVariablesChange = (next: NonNullable<typeof variables>): void => {
    storeApi.getState().patchSchema(
      { variables: next.length > 0 ? next : undefined },
      { coalesce: false }
    );
  };

  return (
    <div css={bodyCss}>
      <section css={sectionCss}>
        <FormDataSourcesPanel
          dataSources={dataSources ?? []}
          title="数据源"
          onChange={handleDataSourcesChange}
        />
      </section>

      <section css={sectionCss}>
        {hasSystemVariables
          ? (
              <>
                <div css={sectionTitleCss}>变量</div>

                <FormVariablesPanel
                  title="表单变量"
                  titleLevel="sub"
                  variables={variables ?? []}
                  onChange={handleVariablesChange}
                />

                <div css={followingSubSectionCss}>
                  <div css={subSectionTitleCss}>系统变量</div>
                  <SystemVariablesPanel />
                </div>
              </>
            )
          : (
              <FormVariablesPanel
                title="变量"
                variables={variables ?? []}
                onChange={handleVariablesChange}
              />
            )}
      </section>
    </div>
  );
}
