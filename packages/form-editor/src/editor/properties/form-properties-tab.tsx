import type { ReactElement } from "react";

import type { FormSchemaPatch } from "../../store/form-store";

import { css } from "@emotion/react";
import { globalCssVars, ScrollArea } from "@vef-framework-react/components";

import { useCurrentLayer, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { panelBodyCss } from "../styles";
import { FormBasicsSection } from "./form-basics-section";
import { FormLinkagePanel } from "./form-linkage-panel";
import { LinkageOverview } from "./linkage-overview";

const bodyInnerCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 22,
  padding: "22px 20px 24px",
  // Cap the body at the panel width so wide controls (CodeMirror inside form
  // events) never widen the scroll viewport's content track.
  contain: "inline-size"
});

const groupCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 12
});

const groupTitleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText,
  letterSpacing: 0,
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
  marginTop: 6
});

/**
 * Right panel's `表单` tab: form ID, per-device layout gap, and the unified
 * linkage section (read-only field-linkage overview followed by editable form
 * events). Mounted only while `表单` is the active right-panel tab so its
 * tree walks never run while editing a control.
 */
export function FormPropertiesTab(): ReactElement {
  const schema = useFormEditorStore(s => s.schema);
  const layer = useCurrentLayer();
  const storeApi = useFormEditorStoreApi();

  const patch = (next: FormSchemaPatch): void => {
    storeApi.getState().patchSchema(next);
  };

  return (
    <ScrollArea css={panelBodyCss} scrollbars="vertical">
      <div css={bodyInnerCss}>
        <FormBasicsSection layer={layer} schema={schema} onPatch={patch} />

        <section css={groupCss}>
          <div css={groupTitleCss}>联动</div>

          <div>
            <div css={subSectionTitleCss}>字段联动</div>
            <LinkageOverview />
          </div>

          <div css={followingSubSectionCss}>
            <div css={subSectionTitleCss}>表单事件</div>
            <FormLinkagePanel schema={schema} onChange={linkage => patch({ linkage })} />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
