import type { ReactElement } from "react";

import type { ConversionReport } from "../../engine/conversion";

import { css } from "@emotion/react";
import { Button, globalCssVars } from "@vef-framework-react/components";

import { convertPresentation, createDefaultConversionRules } from "../../engine/conversion";
import { currentLayer, emptyLayer } from "../../engine/schema/presentation";
import { EditorIcon } from "../../icons";
import { useDeviceRegistries } from "../../store/engine-provider";
import { useFormEditorStoreApi } from "../../store/form-store";
import { infoDialog, notify } from "../toolbar/notify";

// The PC → mobile conversion rules are stateless, so one shared instance serves
// every seed action.
const CONVERSION_RULES = createDefaultConversionRules();

const seedStateCss = css({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: globalCssVars.spacingMd,
  minHeight: 220,
  padding: globalCssVars.spacingXl,
  border: `1px dashed ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius,
  textAlign: "center",

  // Direct child only: this styles the seed state's own headline glyph. The
  // descendant form (`& svg`) used to leak into the action buttons below and
  // blow their icons up to 28px in tertiary gray on the primary fill. The glyph
  // shares EmptyZone's tertiary tint (one canvas-placeholder tone); only its
  // larger size marks this as the full-canvas seed prompt rather than an inline
  // drop hint.
  "& > svg": {
    width: 28,
    height: 28,
    color: globalCssVars.colorTextTertiary
  }
});

const seedTitleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary
});

const seedHintCss = css({
  maxWidth: 280,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.6,
  color: globalCssVars.colorTextTertiary
});

const seedActionsCss = css({
  display: "flex",
  gap: globalCssVars.spacingSm,
  marginTop: globalCssVars.spacingXs
});

const droppedListCss = css({
  margin: 0,
  paddingLeft: "1.2em",
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingXs,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.6,
  color: globalCssVars.colorTextSecondary,
  textAlign: "left"
});

/**
 * The lossy half of a conversion report: which components were skipped and
 * why. The toast only says "N 个无法转换" — this list is the actual answer.
 */
function DroppedList({ dropped }: { dropped: ConversionReport["dropped"] }): ReactElement {
  return (
    <ul css={droppedListCss}>
      {dropped.map((item, index) => (
        <li key={`${item.sourceType}-${index}`}>
          「
          {item.label ?? item.sourceType}
          」：
          {item.reason}
        </li>
      ))}
    </ul>
  );
}

/**
 * Shown on the canvas when the mobile presentation has not been designed yet.
 * Offers a best-effort one-click conversion from the PC design (unmappable
 * components are reported and skipped) or a blank start. Both paths go through
 * the store's `initMobile`, which seeds the mobile presentation and makes it the
 * mobile history baseline.
 */
export function MobileSeedState(): ReactElement {
  const storeApi = useFormEditorStoreApi();
  const registries = useDeviceRegistries();

  const convertFromPc = (): void => {
    const { schema } = storeApi.getState();
    const { layer, report } = convertPresentation(currentLayer(schema, "pc"), CONVERSION_RULES, registries.mobile);

    storeApi.getState().initMobile(layer);

    if (report.dropped.length === 0) {
      notify("success", `已转换 ${report.convertedCount} 个组件`);
      return;
    }

    // A lossy conversion owes the designer the actual casualty list, not just
    // a count — which component, and why it could not come along. The rich body
    // drives the modal; the plain-text `detail` carries the same list to the
    // $vef-less fallback (standalone / tests) so it is never silently dropped.
    infoDialog(
      `已转换 ${report.convertedCount} 个组件，${report.dropped.length} 个无法转换`,
      <DroppedList dropped={report.dropped} />,
      report.dropped.map(item => `「${item.label ?? item.sourceType}」：${item.reason}`).join("\n")
    );
  };

  const startBlank = (): void => {
    storeApi.getState().initMobile(emptyLayer());
  };

  return (
    <div css={seedStateCss}>
      <EditorIcon name="smartphone" />
      <span css={seedTitleCss}>移动端布局尚未设计</span>
      <span css={seedHintCss}>从 PC 布局一键转换（尽力适配，部分组件可能无法转换），或从空白开始搭建移动端专属布局。</span>

      <div css={seedActionsCss}>
        <Button icon={<EditorIcon name="copy" />} type="primary" onClick={convertFromPc}>从 PC 转换</Button>
        <Button onClick={startBlank}>从空白开始</Button>
      </div>
    </div>
  );
}
