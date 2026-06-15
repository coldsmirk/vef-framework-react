import type { FC } from "react";

import type { EntryComponentProps } from "../../../types";

import { css } from "@emotion/react";
import { Checkbox, globalCssVars } from "@vef-framework-react/components";

const wrapperCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "4px 0",
  fontSize: globalCssVars.fontSize,
  color: globalCssVars.colorText
});

const descriptionCss = css({
  paddingLeft: 26,
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.4
});

export const CheckboxEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  onChange
}) => {
  const checked = Boolean(entry.read(field));

  return (
    <div css={wrapperCss}>
      <Checkbox
        checked={checked}
        disabled={entry.readOnly}
        onChange={event => onChange(event.target.checked)}
      >
        {entry.label}
      </Checkbox>

      {entry.description ? <span css={descriptionCss}>{entry.description}</span> : null}
    </div>
  );
};
