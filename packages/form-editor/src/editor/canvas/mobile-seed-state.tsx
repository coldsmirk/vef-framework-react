import type { ReactElement } from "react";

import { css } from "@emotion/react";
import { Button, globalCssVars } from "@vef-framework-react/components";

import { emptyLayer } from "../../engine/schema/presentation";
import { EditorIcon } from "../../icons";
import { useDeviceRegistries } from "../../store/engine-provider";
import { useFormEditorStoreApi } from "../../store/form-store";
import { syncMobileFromPc } from "../sync-mobile-from-pc";

const seedStateCss = css({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  alignItems: "center",
  gap: globalCssVars.spacingMd,
  // Placed in the upper part rather than centered: the phone keeps its natural
  // height, so its middle can sit below the fold of a short canvas and take the
  // actions with it.
  padding: `120px ${globalCssVars.spacingXl} ${globalCssVars.spacingXl}`,
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

/**
 * Shown on the canvas when the mobile presentation has not been designed yet.
 * Offers a best-effort one-click sync from the PC design (unmappable components
 * are reported and skipped) or a blank start.
 */
export function MobileSeedState(): ReactElement {
  const storeApi = useFormEditorStoreApi();
  const registries = useDeviceRegistries();

  const startBlank = (): void => {
    storeApi.getState().replaceMobile(emptyLayer());
  };

  return (
    <div css={seedStateCss}>
      <EditorIcon name="smartphone" />
      <span css={seedTitleCss}>移动端布局尚未设计</span>
      <span css={seedHintCss}>从 PC 布局一键同步（尽力适配，部分组件可能无法转换），或从空白开始搭建移动端专属布局。</span>

      <div css={seedActionsCss}>
        <Button icon={<EditorIcon name="refresh-cw" />} type="primary" onClick={() => syncMobileFromPc(storeApi, registries)}>从 PC 同步</Button>
        <Button onClick={startBlank}>从空白开始</Button>
      </div>
    </div>
  );
}
