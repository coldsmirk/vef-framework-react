import type { ReactElement } from "react";

import type { ValidationIssue } from "../engine/validation";

import { css } from "@emotion/react";
import { globalCssVars, ScrollArea } from "@vef-framework-react/components";
import { useDeferredValue, useMemo } from "react";

import { validateSchema } from "../engine/schema/validate";
import { useDeviceRegistries } from "../store/engine-provider";
import { useFormEditorStore } from "../store/form-store";

const scrollCss = css({
  maxHeight: 240
});

const listCss = css({
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

const pathCss = css({
  marginRight: globalCssVars.spacingXs,
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  wordBreak: "break-all"
});

const restCss = css({
  listStyle: "none",
  color: globalCssVars.colorTextTertiary
});

/**
 * Issues beyond this count collapse into a single "等 N 项…" line — the list is
 * a summary for a confirm dialog / banner, not a full report.
 */
const MAX_VISIBLE_ISSUES = 8;

export interface IssueListProps {
  issues: ValidationIssue[];
}

/**
 * The live schema's validation issues, for passive diagnostic surfaces (the
 * footer chip). Deferred: the urgent render after a keystroke ships first and
 * the full-schema validation pass follows at transition priority, so typing
 * latency never pays for diagnostics. One pass per schema version — `useMemo`
 * keyed on the deferred schema reference.
 */
export function useSchemaIssues(): ValidationIssue[] {
  const schema = useFormEditorStore(s => s.schema);
  const registries = useDeviceRegistries();
  const deferredSchema = useDeferredValue(schema);

  return useMemo(() => validateSchema(deferredSchema, registries).issues, [deferredSchema, registries]);
}

/**
 * Compact bullet list of validation issues (`path：message` per line), shared
 * by the publish confirmation, the export banner, and the footer diagnostics
 * popover so every surface reads the same way.
 */
export function IssueList({ issues }: IssueListProps): ReactElement {
  const visible = issues.slice(0, MAX_VISIBLE_ISSUES);
  const rest = issues.length - visible.length;

  return (
    <ScrollArea css={scrollCss}>
      <ul css={listCss}>
        {visible.map(issue => (
          <li key={`${issue.path}:${issue.code}`}>
            {issue.path.length > 0 ? <span css={pathCss}>{issue.path}</span> : null}
            {issue.message}
          </li>
        ))}

        {rest > 0
          ? (
              <li css={restCss}>
                等
                {rest}
                {" "}
                项…
              </li>
            )
          : null}
      </ul>
    </ScrollArea>
  );
}
