import type { ReactElement } from "react";

import type { FieldLinkage, FieldLinkageRule, FormSchema } from "../../types";

import { FORM_TRIGGER_KINDS } from "../../engine/linkage";
import { createFormRule } from "./entries/linkage/mutators";
import { RuleListEditor } from "./entries/linkage/rule-list-editor";
import { useLinkageEditorModel } from "./entries/linkage/use-linkage-editor-model";

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
  // Form-scope linkage is shared across devices, so it resolves against the
  // canonical pc tree (not the active device's), root-scope fields only —
  // matching how `validateSchema` validates it.
  const { issuesByRule, scope } = useLinkageEditorModel(null);
  const { fieldOptions } = scope;
  const rules = schema.linkage?.rules ?? [];
  // A `condition` trigger with no comparable root-scope source field yields an
  // empty group the validator rejects and the builder can't repair, so drop it
  // from the palette (mirroring the field-level linkage entry).
  const triggerKinds = fieldOptions.length > 0 ? FORM_TRIGGER_KINDS : FORM_TRIGGER_KINDS_NO_CONDITION;

  const commit = (next: FieldLinkageRule[]): void => {
    onChange(next.length > 0 ? { rules: next } : undefined);
  };

  return (
    <RuleListEditor
      allowStateActions={false}
      createRule={() => createFormRule(fieldOptions[0]?.value)}
      issuesByRule={issuesByRule}
      isTargetKeyed={false}
      noun="事件"
      ownerLabel="表单事件"
      ownerNodeId={null}
      rules={rules}
      scope={scope}
      triggerKinds={triggerKinds}
      onChange={commit}
    />
  );
}
