import type { ReactElement } from "react";

import type { FieldLinkage, FieldLinkageRule, FormSchema } from "../../types";

import { FORM_TRIGGER_KINDS } from "../../engine/linkage";
import { useFormEditorStore } from "../../store/form-store";
import { createFormRule } from "./entries/linkage/mutators";
import { RuleListEditor } from "./entries/linkage/rule-list-editor";
import { useLinkageEditorModel } from "./entries/linkage/use-linkage-editor-model";

// Precomputed (vs a fresh `.filter` per render) so the trigger-kind list keeps a
// stable identity and never busts the rule cards' memo when there is no source.
const FORM_TRIGGER_KINDS_NO_CONDITION = FORM_TRIGGER_KINDS.filter(kind => kind !== "condition");

export interface FormLinkagePanelProps {
  schema: FormSchema;
  onChange: (linkage: FieldLinkage | undefined) => void;
}

/**
 * Form-scope linkage editor — the global "events" panel. Reuses the shared
 * {@link RuleListEditor} with the form policy: lifecycle / condition triggers,
 * effect actions only, and a form-specific new-rule seed. Form-wide conditions
 * resolve against root-scope keyed fields.
 */
export function FormLinkagePanel({ onChange, schema }: FormLinkagePanelProps): ReactElement {
  // Form-scope linkage is shared across devices, so its source fields resolve
  // against the canonical pc tree (not the active device's) and root-scope
  // fields only — matching how `validateSchema` validates the shared form
  // linkage. `formLinkage` is threaded so the deferred diagnostics validate the
  // shared linkage too (rule ids are unique, so field-scope issues never leak
  // in). One option list feeds both the condition source and `set_field` target.
  const pcLayer = useFormEditorStore(state => state.schema.presentations.pc);
  const rules = schema.linkage?.rules ?? [];
  const {
    dataSourceOptions,
    fieldOptions: sourceOptions,
    issuesByRule,
    variableNames
  } = useLinkageEditorModel({
    layer: pcLayer,
    nodeId: null,
    dataSources: schema.dataSources,
    variables: schema.variables,
    formLinkage: schema.linkage
  });
  // A `condition` trigger with no comparable root-scope source field yields an
  // empty group the validator rejects and the builder can't repair, so drop it
  // from the palette (mirroring the field-level linkage entry).
  const triggerKinds = sourceOptions.length > 0 ? FORM_TRIGGER_KINDS : FORM_TRIGGER_KINDS_NO_CONDITION;

  const commit = (next: FieldLinkageRule[]): void => {
    onChange(next.length > 0 ? { rules: next } : undefined);
  };

  return (
    <RuleListEditor
      allowStateActions={false}
      createRule={() => createFormRule(sourceOptions[0]?.value)}
      dataSourceOptions={dataSourceOptions}
      issuesByRule={issuesByRule}
      isTargetKeyed={false}
      noun="事件"
      rules={rules}
      sourceOptions={sourceOptions}
      // Form scope has no "self" field, so condition sources and set_field
      // targets are the same root-scope keyed-field list.
      targetOptions={sourceOptions}
      triggerKinds={triggerKinds}
      variableNames={variableNames}
      onChange={commit}
    />
  );
}
