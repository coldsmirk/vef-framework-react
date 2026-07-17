import type { CompletionEntry } from "@vef-framework-react/components";
import type { CSSProperties, ReactNode } from "react";

import type { ScriptDoc } from "./completions";

import { css } from "@emotion/react";
import { Flex, globalCssVars, Icon, Popover, Stack, Text } from "@vef-framework-react/components";
import { CircleHelpIcon } from "lucide-react";

const helpIconCss = css({
  marginInlineStart: 4,
  color: globalCssVars.colorTextTertiary,
  cursor: "help",
  transition: `color ${globalCssVars.motionDurationMid}`,
  "&:hover": {
    color: globalCssVars.colorPrimary
  }
});

const contentCss = css({
  width: "min(480px, 80vw)"
});

const entryListCss = css({
  maxHeight: 420,
  overflowY: "auto",
  paddingInlineEnd: 4
});

const memberListCss = css({
  paddingInlineStart: 14
});

const smallFont: CSSProperties = {
  fontSize: globalCssVars.fontSizeSm
};

function signature(entry: CompletionEntry): string {
  return entry.detail ? `${entry.label}${entry.detail}` : entry.label;
}

function MemberLine({ entry }: { entry: CompletionEntry }) {
  return (
    <Flex align="baseline" gap="small" wrap="wrap">
      <Text code style={smallFont}>{signature(entry)}</Text>
      {entry.info ? <Text style={smallFont} type="secondary">{entry.info}</Text> : null}
    </Flex>
  );
}

function EntryDoc({ entry }: { entry: CompletionEntry }) {
  return (
    <Stack gap={4}>
      <Flex align="baseline" gap="small" wrap="wrap">
        <Text code>{signature(entry)}</Text>
        {entry.info ? <Text style={smallFont} type="secondary">{entry.info}</Text> : null}
      </Flex>

      {entry.children?.length
        ? (
            <Stack css={memberListCss} gap={2}>
              {entry.children.map(child => <MemberLine key={child.label} entry={child} />)}
            </Stack>
          )
        : null}
    </Stack>
  );
}

function ScriptDocContent({ doc }: { doc: ScriptDoc }) {
  return (
    <Stack css={contentCss} gap={10}>
      <Text style={smallFont} type="secondary">{doc.summary}</Text>

      <div css={entryListCss}>
        <Stack gap={10}>
          {doc.entries.map(entry => <EntryDoc key={entry.label} entry={entry} />)}
        </Stack>
      </div>
    </Stack>
  );
}

export interface ScriptDocLabelProps {
  /**
   * The visible label text the help icon follows.
   */
  label: ReactNode;
  /**
   * The script surface's documentation — the same catalog that powers the
   * editor's completions.
   */
  doc: ScriptDoc;
}

/**
 * A script-editor label with a help icon: hovering it opens the surface's
 * full documentation (contract summary, bindings, libraries and functions),
 * rendered from the completion catalog so the two can never drift apart.
 */
export function ScriptDocLabel({ label, doc }: ScriptDocLabelProps) {
  return (
    <>
      {label}

      <Popover content={<ScriptDocContent doc={doc} />} placement="right" title="脚本文档">
        <Icon component={CircleHelpIcon} css={helpIconCss} />
      </Popover>
    </>
  );
}
