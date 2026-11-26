import type { WritableTargetField } from "../../../../engine/linkage";
import type { ValidationIssue } from "../../../../engine/validation";
import type {
  FieldLinkage,
  FieldLinkageRule,
  FormDataSource,
  KeyedFormField,
  LinkageContextSource
} from "../../../../types";
import type { SourceFieldOption } from "./options";

import { isDeepEqual } from "@vef-framework-react/shared";
import { useDeferredValue, useMemo, useRef } from "react";

import { isKeyedField } from "../../../../engine/keys";
import { isWritableTargetField, validateLinkageSchema } from "../../../../engine/linkage";
import { updateNode } from "../../../../engine/schema/mutate";
import { useCurrentLayer, useFormEditorStore } from "../../../../store/form-store";
import { useContextSources } from "../../../context-sources";
import { useScopeFields } from "../../scope-fields";
import { getDataSourceOptions, getSourceFieldOptions, getTargetFieldOptions } from "./options";
import { groupIssuesByRule, stabilizeIssueBuckets } from "./rule-diagnostics";

const NO_DATA_SOURCES: readonly FormDataSource[] = [];
const EMPTY_ISSUES: readonly ValidationIssue[] = [];

/**
 * What the rules of one linkage panel can read and write, excluding form
 * variables (`$vars`). Variables are subscribed only inside the open rule
 * dialog so `$vars` edits never re-render the rule list.
 */
export interface LinkageScope {
  /**
   * Keyed fields in the owner's value scope, ready for source pickers.
   */
  fieldOptions: SourceFieldOption[];
  /**
   * Host-declared system variables (`$applicant.*`, `$globals.*`).
   */
  contextSources: readonly LinkageContextSource[];
  /**
   * The keyed fields sharing the owner's value scope.
   */
  fieldsByKey: ReadonlyMap<string, KeyedFormField>;
  /**
   * The ones `set_fields` can write, and their picker options.
   */
  writableTargets: readonly WritableTargetField[];
  targetOptions: SourceFieldOption[];
  /**
   * The form's data sources, and their picker options.
   */
  dataSources: readonly FormDataSource[];
  dataSourceOptions: SourceFieldOption[];
}

export interface LinkageEditorModel {
  scope: LinkageScope;
  /**
   * Validator issues hung onto each committed rule by id, for list row badges.
   */
  issuesByRule: ReturnType<typeof groupIssuesByRule>;
}

/**
 * The model behind every linkage editor — a field's, a container's, and the
 * form's events (`null`). Each resolves the value scope its owner sits in: a
 * subform field references its row siblings, not the outer form.
 *
 * Validation only changes on a structural edit, so like the scope walk it runs
 * against deferred values.
 */
export function useLinkageEditorModel(ownerNodeId: string | null): LinkageEditorModel {
  const fields = useScopeFields(ownerNodeId);
  const contextSources = useContextSources();
  const dataSources = useFormEditorStore(state => state.schema.dataSources) ?? NO_DATA_SOURCES;

  const scope = useMemo<LinkageScope>(
    () => {
      return {
        fieldOptions: getSourceFieldOptions({ components: fields }),
        contextSources,
        fieldsByKey: new Map(fields.filter(isKeyedField).map(field => [field.key, field])),
        writableTargets: fields.filter(isWritableTargetField),
        targetOptions: getTargetFieldOptions({ components: fields }),
        dataSources,
        dataSourceOptions: getDataSourceOptions(dataSources)
      };
    },
    [fields, contextSources, dataSources]
  );

  const currentLayer = useCurrentLayer();
  const pcLayer = useFormEditorStore(state => state.schema.presentations.pc);
  // Only the form's own panel shows the form linkage's issues; rule ids are
  // unique, so the fields' issues never leak into its rows.
  const formLinkage = useFormEditorStore(state => ownerNodeId === null ? state.schema.linkage : undefined);
  const layer = useDeferredValue(ownerNodeId === null ? pcLayer : currentLayer);
  const deferredFormLinkage = useDeferredValue(formLinkage);

  // Bucket identities are reconciled against the previous run so an
  // issue-carrying row keeps stable issue counts across unrelated edits.
  const issuesByRuleRef = useRef<Map<string, ValidationIssue[]>>(undefined);
  const issuesByRule = useMemo(
    () => stabilizeIssueBuckets(
      issuesByRuleRef.current,
      groupIssuesByRule(validateLinkageSchema(layer, deferredFormLinkage).issues)
    ),
    [layer, deferredFormLinkage]
  );

  issuesByRuleRef.current = issuesByRule;

  return { scope, issuesByRule };
}

function withRuleSubstituted(linkage: FieldLinkage | undefined, draft: FieldLinkageRule): FieldLinkage {
  const existing = linkage?.rules ?? [];
  const nextRules = existing.some(rule => rule.id === draft.id)
    ? existing.map(rule => rule.id === draft.id ? draft : rule)
    : [...existing, draft];

  return { ...linkage, rules: nextRules };
}

/**
 * Live validation issues for the rule currently being drafted in the rule
 * dialog: validates the deferred layer with `draft` substituted in place of the
 * committed rule (or appended when creating), so diagnostics always reflect
 * what the author is looking at rather than the stale committed rule.
 */
export function useDraftRuleIssues(
  ownerNodeId: string | null,
  draft: FieldLinkageRule
): readonly ValidationIssue[] {
  const currentLayer = useCurrentLayer();
  const pcLayer = useFormEditorStore(state => state.schema.presentations.pc);
  const formLinkage = useFormEditorStore(state => ownerNodeId === null ? state.schema.linkage : undefined);

  const deferredLayer = useDeferredValue(ownerNodeId === null ? pcLayer : currentLayer);
  const deferredFormLinkage = useDeferredValue(formLinkage);
  const deferredDraft = useDeferredValue(draft);

  const issuesRef = useRef<readonly ValidationIssue[]>(EMPTY_ISSUES);
  const issues = useMemo<readonly ValidationIssue[]>(() => {
    const result = ownerNodeId === null
      ? validateLinkageSchema(deferredLayer, withRuleSubstituted(deferredFormLinkage, deferredDraft))
      : validateLinkageSchema(
          updateNode(deferredLayer, ownerNodeId, node => {
            return { ...node, linkage: withRuleSubstituted(node.linkage, deferredDraft) };
          })
        );
    const matching = result.issues.filter(issue => issue.ruleId === deferredDraft.id);

    if (matching.length === 0) {
      return EMPTY_ISSUES;
    }

    return isDeepEqual(issuesRef.current, matching) ? issuesRef.current : matching;
  }, [ownerNodeId, deferredLayer, deferredFormLinkage, deferredDraft]);

  issuesRef.current = issues;

  return issues;
}
