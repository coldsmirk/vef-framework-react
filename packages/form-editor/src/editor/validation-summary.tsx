import type { ReactElement } from "react";

import type { DeviceRegistries } from "../engine/registry/form-field-registry";
import type { SchemaIssue } from "../engine/validation";
import type { FormSchema } from "../types";
import type { SchemaValidator } from "./host-validation";

import { css } from "@emotion/react";
import { globalCssVars, ScrollArea } from "@vef-framework-react/components";
import { useDeferredValue, useMemo } from "react";

import { validateSchema } from "../engine/schema/validate";
import { EditorIcon } from "../icons";
import { useDeviceRegistries } from "../store/engine-provider";
import { useFormEditorStore } from "../store/form-store";
import { useHostValidation } from "./host-validation";

const scrollCss = css({
  maxHeight: 240
});

const navigatorScrollCss = css({
  maxHeight: 320
});

const listCss = css({
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  textAlign: "left"
});

const rowCss = css({
  display: "flex",
  alignItems: "flex-start",
  gap: 6,
  width: "100%",
  padding: "4px 6px",
  border: "none",
  borderRadius: globalCssVars.borderRadiusSm,
  background: "transparent",
  color: globalCssVars.colorTextSecondary,
  font: "inherit",
  textAlign: "left"
});

const actionRowCss = css({
  cursor: "pointer",
  transition: `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "&:hover, &:focus-visible": {
    outline: "none",
    background: globalCssVars.colorFillTertiary,
    color: globalCssVars.colorText
  }
});

const iconCss = css({
  flexShrink: 0,
  marginTop: 2,
  display: "inline-flex",

  "& svg": { width: 13, height: 13 }
});

const errorIconCss = css({ color: globalCssVars.colorError });

const warningIconCss = css({ color: globalCssVars.colorWarning });

const textCss = css({
  display: "flex",
  flexDirection: "column",
  minWidth: 0
});

const pathCss = css({
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  wordBreak: "break-all"
});

// A location the designer named reads as text, not code.
const locationCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  wordBreak: "break-all"
});

const restCss = css({
  padding: "0 6px",
  color: globalCssVars.colorTextTertiary
});

/**
 * Issues beyond this count collapse into a single "等 N 项…" line in a read-only
 * summary — it backs a confirm dialog, not a full report.
 */
const MAX_SUMMARY_ISSUES = 8;

/**
 * Everything the editor knows to be wrong with a schema: its structural
 * validation, then — only for a schema free of structural errors, which is
 * all a host validator is promised — the host's own checks.
 */
export function collectSchemaIssues(
  schema: FormSchema,
  registries: DeviceRegistries,
  validate: SchemaValidator | undefined
): SchemaIssue[] {
  const result = validateSchema(schema, registries);

  if (validate === undefined || result.schema === undefined) {
    return result.issues;
  }

  return [...result.issues, ...validate(result.schema)];
}

/**
 * The live schema's issues — structural and the host's — for passive
 * diagnostic surfaces (the footer chip). Deferred: the urgent render after a
 * keystroke ships first and the validation pass follows at transition
 * priority, so typing latency never pays for diagnostics. One pass per schema
 * version — `useMemo` keyed on the deferred schema reference.
 */
export function useSchemaIssues(): SchemaIssue[] {
  const schema = useFormEditorStore(s => s.schema);
  const registries = useDeviceRegistries();
  const validate = useHostValidation();
  const deferredSchema = useDeferredValue(schema);

  return useMemo(() => collectSchemaIssues(deferredSchema, registries, validate), [deferredSchema, registries, validate]);
}

export interface IssueListProps {
  issues: readonly SchemaIssue[];
  /**
   * Where an issue is, in the designer's words — the field's name, the data
   * source's — shown under its message in place of the raw path, which stays
   * available as the location's tooltip. An issue it has no words for shows
   * its path.
   */
  describeLocation?: (issue: SchemaIssue) => string | undefined;
  /**
   * Turns the list into a navigator: every issue is listed, and each one that
   * resolves to an action renders as a button running it — the footer's "take
   * me to the problem". Without it the list is a read-only summary of the first
   * few issues, for confirm dialogs.
   */
  resolveAction?: (issue: SchemaIssue) => (() => void) | undefined;
}

function IssueRowContent({ issue, location }: { issue: SchemaIssue; location: string | undefined }): ReactElement {
  const isError = issue.severity === "error";
  const where = location ?? issue.path;

  return (
    <>
      <span css={[iconCss, isError ? errorIconCss : warningIconCss]}>
        <EditorIcon name={isError ? "circle-alert" : "triangle-alert"} />
      </span>

      <span css={textCss}>
        <span>{issue.message}</span>

        {where.length > 0
          ? <span css={location === undefined ? pathCss : locationCss} title={issue.path}>{where}</span>
          : null}
      </span>
    </>
  );
}

/**
 * The issue list every diagnostic surface shares — the publish confirmation and
 * the footer navigator — so a problem reads the same wherever it is shown: the
 * message, then where it is.
 */
export function IssueList({
  describeLocation,
  issues,
  resolveAction
}: IssueListProps): ReactElement {
  const visible = resolveAction === undefined ? issues.slice(0, MAX_SUMMARY_ISSUES) : issues;
  const rest = issues.length - visible.length;

  return (
    <ScrollArea css={resolveAction === undefined ? scrollCss : navigatorScrollCss}>
      <ul css={listCss}>
        {/* Issues carry no identity of their own; the list is rebuilt whole
            from each validation pass, so position is a stable key. */}
        {visible.map((issue, index) => {
          const action = resolveAction?.(issue);
          const content = <IssueRowContent issue={issue} location={describeLocation?.(issue)} />;

          return (
            <li key={index}>
              {action === undefined
                ? <div css={rowCss}>{content}</div>
                : <button css={[rowCss, actionRowCss]} type="button" onClick={action}>{content}</button>}
            </li>
          );
        })}

        {rest > 0 ? <li css={restCss}>{`等 ${rest} 项…`}</li> : null}
      </ul>
    </ScrollArea>
  );
}
