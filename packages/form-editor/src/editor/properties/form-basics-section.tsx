import type { ChangeEvent, ReactElement } from "react";

import type { FormSchemaPatch } from "../../store/form-store";
import type { FormSchema, GapScale, PresentationLayer } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars, Input, Select } from "@vef-framework-react/components";
import { useId, useState } from "react";

// Fills the field column like every other Select in the editor (the shared
// `selectStyle` in select-entry / options-source / form-variables-panel), rather
// than collapsing to its single-word options' intrinsic width.
const selectStyle = { width: "100%" } as const;

const groupCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 14
});

const groupTitleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText,
  letterSpacing: 0,
  paddingBottom: 6,
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const fieldCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6
});

const labelCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary,
  letterSpacing: 0
});

const descriptionCss = css({
  fontSize: 12,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.4
});

const fieldErrorCss = css({
  fontSize: 12,
  color: globalCssVars.colorErrorText,
  lineHeight: 1.4
});

const GAP_OPTIONS: Array<{ label: string; value: GapScale }> = [
  { label: "小", value: "small" },
  { label: "中", value: "medium" },
  { label: "大", value: "large" }
];

export interface FormBasicsSectionProps {
  /**
   * The active device's presentation — source of the per-device layout default
   * (stack gap).
   */
  layer: PresentationLayer;
  /**
   * The schema — source of the shared root metadata (`id`).
   */
  schema: FormSchema;
  onPatch: (patch: FormSchemaPatch) => void;
}

/**
 * Form-level identity (`id`) and per-device layout default (`gap`), mounted at
 * the top of the right panel's `表单` tab.
 *
 * The form ID is the only free-form input the schema validator constrains
 * (`id_required`: non-empty string — a blanked id would fail re-import), so it
 * is guarded at the patch site: an empty / whitespace-only draft is kept
 * visible with an inline error instead of being committed or silently
 * reverted. The gap select offers only valid presets, so it needs no guard.
 */
export function FormBasicsSection({
  layer,
  onPatch,
  schema
}: FormBasicsSectionProps): ReactElement {
  const formIdInputId = useId();
  const gapId = useId();
  // Pending invalid id text, or null when the input mirrors the schema. Only
  // invalid drafts are held locally — valid input patches straight through, so
  // external schema changes (undo / import) keep flowing into the input.
  const [invalidIdDraft, setInvalidIdDraft] = useState<string | null>(null);

  const handleIdChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = event.target.value;

    if (next.trim().length === 0) {
      setInvalidIdDraft(next);
      return;
    }

    setInvalidIdDraft(null);
    onPatch({ id: next });
  };

  return (
    <>
      <section css={groupCss}>
        <div css={groupTitleCss}>基础</div>

        <div css={fieldCss}>
          <label css={labelCss} htmlFor={formIdInputId}>表单 ID</label>

          <Input
            autoComplete="off"
            id={formIdInputId}
            name="form-id"
            placeholder="请输入表单 ID…"
            status={invalidIdDraft === null ? undefined : "error"}
            value={invalidIdDraft ?? schema.id}
            onChange={handleIdChange}
          />

          {invalidIdDraft === null
            ? <span css={descriptionCss}>用于导出 Schema 的根节点标识</span>
            : <span css={fieldErrorCss} role="alert">表单 ID 不能为空，修改未保存</span>}
        </div>
      </section>

      <section css={groupCss}>
        <div css={groupTitleCss}>布局</div>

        <div css={fieldCss}>
          <label css={labelCss} htmlFor={gapId}>元素间距</label>

          <Select<GapScale>
            id={gapId}
            options={GAP_OPTIONS}
            style={selectStyle}
            value={layer.gap ?? "medium"}
            onChange={gap => onPatch({ gap })}
          />
        </div>
      </section>
    </>
  );
}
