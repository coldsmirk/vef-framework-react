import type { ReactElement } from "react";

import type { ValidationIssue } from "../../../../engine/validation";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { isDeepEqual } from "@vef-framework-react/shared";

const listCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 4
});

const lineCss = css({
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5
});

const dotCss = css({
  flexShrink: 0,
  width: 6,
  height: 6,
  borderRadius: "50%",
  alignSelf: "center"
});

const warningLineCss = css({
  color: globalCssVars.colorWarningText
});

const warningDotCss = css({
  background: globalCssVars.colorWarning
});

const errorLineCss = css({
  color: globalCssVars.colorErrorText
});

const errorDotCss = css({
  background: globalCssVars.colorError
});

/**
 * Index rule-scoped validation issues by their `ruleId` so the rule-list
 * editor can hang each issue onto the card of the rule that produced it.
 * Issues without a `ruleId` (schema-envelope problems, cross-rule cycles) are
 * not card-addressable and are dropped here.
 */
export function groupIssuesByRule(issues: readonly ValidationIssue[]): Map<string, ValidationIssue[]> {
  const byRule = new Map<string, ValidationIssue[]>();

  for (const issue of issues) {
    if (issue.ruleId === undefined) {
      continue;
    }

    const bucket = byRule.get(issue.ruleId) ?? [];
    bucket.push(issue);
    byRule.set(issue.ruleId, bucket);
  }

  return byRule;
}

/**
 * Reference-reconcile a freshly-grouped issue map against the prior one.
 * {@link groupIssuesByRule} allocates fresh buckets on every revalidation
 * (every schema edit moves the deferred layer reference), which would hand
 * every issue-carrying RuleCard a new `issues` prop identity — busting its
 * memo on each keystroke anywhere in the form. A bucket whose content is
 * unchanged keeps its previous array reference; a fully unchanged map keeps
 * its own reference (mirroring the runtime's `stabilizeStateMap`).
 */
export function stabilizeIssueBuckets(
  prev: Map<string, ValidationIssue[]> | undefined,
  next: Map<string, ValidationIssue[]>
): Map<string, ValidationIssue[]> {
  if (!prev) {
    return next;
  }

  let changed = prev.size !== next.size;
  const reconciled = new Map<string, ValidationIssue[]>();

  for (const [ruleId, bucket] of next) {
    const previous = prev.get(ruleId);

    if (previous !== undefined && isDeepEqual(previous, bucket)) {
      reconciled.set(ruleId, previous);
    } else {
      reconciled.set(ruleId, bucket);
      changed = true;
    }
  }

  return changed ? reconciled : prev;
}

export interface RuleDiagnosticsProps {
  issues: readonly ValidationIssue[];
}

/**
 * Compact per-rule diagnostics list rendered inside a rule card — the editor
 * surface of `validateLinkageSchema`, so half-configured or dangling rules are
 * visible while authoring instead of silently dead. Severity drives the
 * styling: warnings are legitimate mid-authoring states, errors mean the rule
 * cannot run.
 */
export function RuleDiagnostics({ issues }: RuleDiagnosticsProps): ReactElement | null {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div css={listCss} role="status">
      {issues.map((issue, index) => (
        <div
          key={`${issue.path}:${issue.code}:${index}`}
          css={[lineCss, issue.severity === "error" ? errorLineCss : warningLineCss]}
        >
          <span css={[dotCss, issue.severity === "error" ? errorDotCss : warningDotCss]} />
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}
