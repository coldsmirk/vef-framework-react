import type { ReactElement } from "react";

import type { LinkageContextSource } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars, Input, Text } from "@vef-framework-react/components";
import { useState } from "react";

import { useContextSources } from "../context-sources";
import { usePreviewSamples } from "../preview-runtime-context";

const wrapperCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8
});

const hintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.6,
  color: globalCssVars.colorTextTertiary
});

// One bordered list, ruled between rows: read-only entries the designer looks
// up, unlike the form variables below it, which are edited in place.
const listCss = css({
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadius
});

const rowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "6px 12px",

  "& + &": {
    borderTop: `1px solid ${globalCssVars.colorBorderSecondary}`
  }
});

const nameCss = css({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minWidth: 0
});

const labelCss = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: globalCssVars.colorText
});

const pathCss = css({
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  color: globalCssVars.colorTextTertiary,
  wordBreak: "break-all"
});

const sampleCss = css({
  width: 200,
  flexShrink: 0
});

/**
 * The host-injected system variables (`contextSources`): read-only values such
 * as the initiator's department, listed so a designer can see what exists,
 * copy the path an expression reads, and try a rule in the preview with a
 * sample value. Renders nothing when the host declares none.
 */
export function SystemVariablesPanel(): ReactElement | null {
  const sources = useContextSources();
  const { samples, setSample } = usePreviewSamples();

  if (sources.length === 0) {
    return null;
  }

  return (
    <div css={wrapperCss}>
      <span css={hintCss}>
        宿主运行时注入的只读值：条件中直接选择，表达式中按路径引用。预览值仅用于设计器预览，不会保存。
      </span>

      <div css={listCss}>
        {sources.map(source => (
          <SystemVariableRow
            key={source.key}
            sample={samples.get(source.key) ?? ""}
            source={source}
            onSampleCommit={value => setSample(source.key, value)}
          />
        ))}
      </div>
    </div>
  );
}

interface SystemVariableRowProps {
  source: LinkageContextSource;
  sample: string;
  onSampleCommit: (value: string) => void;
}

function SystemVariableRow({
  onSampleCommit,
  sample,
  source
}: SystemVariableRowProps): ReactElement {
  return (
    <div css={rowCss}>
      <div css={nameCss}>
        <span css={labelCss} title={source.label}>{source.label}</span>
        <Text copyable={{ tooltips: ["复制路径", "已复制"] }} css={pathCss}>{source.key}</Text>
      </div>

      <SampleInput label={source.label} value={sample} onCommit={onSampleCommit} />
    </div>
  );
}

interface SampleInputProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}

/**
 * Draft-buffered sample editor, committed on blur / Enter: the preview
 * re-renders the whole form for a new evaluation scope, which is a cost to
 * pay once per sample, not once per keystroke.
 */
function SampleInput({
  label,
  onCommit,
  value
}: SampleInputProps): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (): void => {
    if (draft === null) {
      return;
    }

    onCommit(draft.trim());
    setDraft(null);
  };

  return (
    <Input
      aria-label={`${label}的预览值`}
      css={sampleCss}
      placeholder="预览值"
      value={draft ?? value}
      onBlur={commit}
      onChange={event => setDraft(event.target.value)}
      onFocus={() => setDraft(value)}
      onPressEnter={commit}
    />
  );
}
