import type { ReactElement } from "react";

import type { PriorStepSchema } from "../../../../engine/linkage";
import type { FieldLinkageAction } from "../../../../types";
import type { LinkageScope } from "./use-linkage-editor-model";

import { isDeepEqual } from "@vef-framework-react/shared";
import { useMemo, useState } from "react";

import { collectStepOutputNames, getStepOutputName, writeActionOutput } from "../../../../engine/linkage";
import { DraftField, DraftModal } from "../../draft-modal";
import { ReferenceScopeProvider } from "../../reference-scope";
import { CatalogRemoteRequestEditor } from "../../remote-request-editor";
import { withOptional } from "./mutators";
import { OnErrorField } from "./on-error-field";
import { actionLabelFor } from "./options";
import { SelectRecordEditor } from "./select-record-editor";
import { SetFieldsEditor } from "./set-fields-editor";
import { stepOutputError, StepOutputField } from "./step-output-field";

/**
 * The actions with too much to configure for the side panel alone.
 */
export type ModalEditableAction = Extract<FieldLinkageAction, { type: "api_call" | "select_record" | "set_fields" }>;

export function isModalEditableAction(action: FieldLinkageAction): action is ModalEditableAction {
  return action.type === "api_call" || action.type === "select_record" || action.type === "set_fields";
}

const MODAL_WIDTH = 720;

export interface ActionDraftModalProps {
  open: boolean;
  action: ModalEditableAction;
  /**
   * The rule's whole sequence, and this step's place in it.
   */
  actions: readonly FieldLinkageAction[];
  index: number;
  priorSteps: readonly PriorStepSchema[];
  scope: LinkageScope;
  selfKey?: string;
  onClose: () => void;
  onAfterClose: () => void;
  onSubmit: (next: ModalEditableAction) => void;
}

/**
 * Edits one step as a draft, with room for its lists.
 */
export function ActionDraftModal({
  action,
  actions,
  index,
  onAfterClose,
  onClose,
  onSubmit,
  open,
  priorSteps,
  scope,
  selfKey
}: ActionDraftModalProps): ReactElement {
  const [draft, setDraft] = useState(action);
  const [outputError, setOutputError] = useState<string | null>(null);
  const referenceScope = useMemo(
    () => {
      return { ...scope.reference, priorSteps };
    },
    [scope.reference, priorSteps]
  );
  const laterActions = actions.slice(index + 1);

  const handleSubmit = (): void => {
    const error = draft.type === "set_fields"
      ? null
      : stepOutputError(draft.output ?? "", draft.type === "select_record", collectStepOutputNames(actions, index));

    setOutputError(error);

    if (error === null) {
      onSubmit(draft);
      onClose();
    }
  };

  const outputField = (
    <StepOutputField
      error={outputError}
      required={draft.type === "select_record"}
      value={getStepOutputName(draft) ?? ""}
      onChange={name => {
        setOutputError(null);
        setDraft(writeActionOutput(draft, name || undefined));
      }}
    />
  );

  return (
    <DraftModal
      dirty={!isDeepEqual(draft, action)}
      open={open}
      title={`步骤 ${index + 1} · 编辑「${actionLabelFor(draft.type)}」`}
      width={MODAL_WIDTH}
      onAfterClose={onAfterClose}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <ReferenceScopeProvider value={referenceScope}>
        {draft.type === "api_call"
          ? (
              <>
                <DraftField label="接口与参数">
                  <CatalogRemoteRequestEditor
                    showDeclaredFields
                    request={draft.request}
                    onChange={request => setDraft({ ...draft, request })}
                  />
                </DraftField>

                {outputField}
              </>
            )
          : null}

        {draft.type === "select_record"
          ? (
              <SelectRecordEditor
                action={draft}
                fieldsByKey={scope.fieldsByKey}
                laterActions={laterActions}
                outputControl={outputField}
                onChange={setDraft}
              />
            )
          : null}

        {draft.type === "set_fields"
          ? (
              <DraftField label="字段写入映射">
                <SetFieldsEditor
                  assignments={draft.assignments}
                  scope={scope}
                  selfKey={selfKey}
                  onChange={assignments => setDraft({ ...draft, assignments })}
                />
              </DraftField>
            )
          : null}

        <OnErrorField value={draft.onError} onChange={onError => setDraft(withOptional(draft, "onError", onError))} />
      </ReferenceScopeProvider>
    </DraftModal>
  );
}
