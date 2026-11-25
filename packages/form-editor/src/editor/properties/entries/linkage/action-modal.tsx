import type { ReactElement } from "react";

import type { PriorStepSchema, WritableTargetField } from "../../../../engine/linkage";
import type { FieldLinkageAction, FormDataSource, KeyedFormField } from "../../../../types";
import type { ReferenceScope } from "../../reference-scope";
import type { SourceFieldOption } from "./options";

import { Input } from "@vef-framework-react/components";
import { isDeepEqual } from "@vef-framework-react/shared";
import { useId, useMemo, useState } from "react";

import { sanitizeKey } from "../../../../engine/keys";
import { collectStepOutputNames } from "../../../../engine/linkage";
import { isValidIdentifier } from "../../../../engine/validation";
import { DraftField, DraftModal } from "../../draft-modal";
import { ReferenceScopeProvider } from "../../reference-scope";
import { CatalogRemoteRequestEditor } from "../../remote-request-editor";
import { OnErrorSelect } from "./action-editor";
import { actionLabelFor } from "./options";
import { SelectRecordEditor } from "./select-record-editor";
import { SetFieldsEditor } from "./set-fields-editor";

export type ModalEditableAction = Extract<FieldLinkageAction, { type: "api_call" | "select_record" | "set_fields" }>;

export function isModalEditableAction(action: FieldLinkageAction): action is ModalEditableAction {
  return action.type === "api_call" || action.type === "select_record" || action.type === "set_fields";
}

const MODAL_WIDTH = 720;

export interface ActionDraftModalProps {
  open: boolean;
  action: ModalEditableAction;
  actionIndex: number;
  allActions: readonly FieldLinkageAction[];
  referenceScope: ReferenceScope;
  priorSteps: readonly PriorStepSchema[];
  targetOptions: SourceFieldOption[];
  writableTargets: readonly WritableTargetField[];
  scopeFieldsByKey: ReadonlyMap<string, KeyedFormField>;
  dataSources: readonly FormDataSource[];
  onClose: () => void;
  onAfterClose: () => void;
  onSubmit: (next: ModalEditableAction) => void;
}

/**
 * Wide draft modal for complex actions (`api_call`, `select_record`,
 * `set_fields`) built directly on {@link DraftModal} and {@link DraftField}.
 * Edits stage in a `structuredClone` draft and commit atomically on 确定 (so
 * the whole edit — including any downstream step-output rename — is a single
 * undo step).
 */
export function ActionDraftModal({
  action,
  actionIndex,
  allActions,
  dataSources,
  onAfterClose,
  onClose,
  onSubmit,
  open,
  priorSteps,
  referenceScope,
  scopeFieldsByKey,
  targetOptions,
  writableTargets
}: ActionDraftModalProps): ReactElement {
  const [draft, setDraft] = useState<ModalEditableAction>(() => structuredClone(action));
  const [outputError, setOutputError] = useState<string | null>(null);
  const outputId = useId();
  const dirty = useMemo(() => !isDeepEqual(draft, action), [draft, action]);
  const usedOutputs = useMemo(
    () => collectStepOutputNames(allActions, actionIndex),
    [allActions, actionIndex]
  );

  const validateOutput = (candidate: string | undefined, required: boolean): string | null => {
    const trimmed = candidate?.trim() ?? "";

    if (trimmed.length === 0) {
      return required ? "请填写结果名，供后续步骤引用" : null;
    }

    if (!isValidIdentifier(trimmed)) {
      return "结果名需以字母或下划线开头，仅含字母、数字或下划线";
    }

    if (usedOutputs.has(trimmed)) {
      return `结果名「${trimmed}」与本规则其它步骤重复`;
    }

    return null;
  };

  const handleSubmit = (): void => {
    if (draft.type === "api_call") {
      const error = validateOutput(draft.output, false);

      if (error !== null) {
        setOutputError(error);
        return;
      }
    } else if (draft.type === "select_record") {
      const error = validateOutput(draft.output, true);

      if (error !== null) {
        setOutputError(error);
        return;
      }
    }

    onSubmit(draft);
    onClose();
  };

  const updateOnError = (onError: "stop" | "continue"): void => {
    if (onError === "continue") {
      setDraft(current => {
        return { ...current, onError: "continue" };
      });
      return;
    }

    setDraft(current => {
      const next = { ...current };
      delete next.onError;
      return next;
    });
  };

  const title = `步骤 ${actionIndex + 1} · 编辑「${actionLabelFor(draft.type)}」`;

  return (
    <DraftModal
      dirty={dirty}
      open={open}
      title={title}
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
                    onChange={request => setDraft(current => current.type === "api_call" ? { ...current, request } : current)}
                  />
                </DraftField>

                <DraftField
                  error={outputError}
                  hint="留空表示不保存结果；改名后将自动更新本规则内所有后续引用。"
                  htmlFor={outputId}
                  label="结果名"
                >
                  <Input
                    id={outputId}
                    placeholder="如 result"
                    status={outputError === null ? undefined : "error"}
                    value={draft.output ?? ""}
                    onChange={event => {
                      const sanitized = sanitizeKey(event.target.value);

                      setOutputError(null);
                      setDraft(current => {
                        if (current.type !== "api_call") {
                          return current;
                        }

                        if (sanitized.length === 0) {
                          const next = { ...current };
                          delete next.output;
                          return next;
                        }

                        return { ...current, output: sanitized };
                      });
                    }}
                  />
                </DraftField>
              </>
            )
          : null}

        {draft.type === "select_record"
          ? (
              <SelectRecordEditor
                action={draft}
                actionIndex={actionIndex}
                allActions={allActions}
                scopeFieldsByKey={scopeFieldsByKey}
                outputControl={(
                  <DraftField
                    required
                    error={outputError}
                    hint="改名后将自动更新本规则内所有后续引用。"
                    htmlFor={outputId}
                    label="结果名"
                  >
                    <Input
                      id={outputId}
                      placeholder="如 selected"
                      status={outputError === null ? undefined : "error"}
                      value={draft.output}
                      onChange={event => {
                        const sanitized = sanitizeKey(event.target.value);

                        setOutputError(null);
                        setDraft(current => current.type === "select_record" ? { ...current, output: sanitized } : current);
                      }}
                    />
                  </DraftField>
                )}
                onChange={next => setDraft(next)}
              />
            )
          : null}

        {draft.type === "set_fields"
          ? (
              <DraftField label="字段写入映射">
                <SetFieldsEditor
                  assignments={draft.assignments}
                  dataSources={dataSources}
                  priorSteps={priorSteps}
                  targetOptions={targetOptions}
                  writableTargets={writableTargets}
                  onChange={assignments => setDraft(current => current.type === "set_fields" ? { ...current, assignments } : current)}
                />
              </DraftField>
            )
          : null}

        <DraftField
          hint="默认失败时立即终止本规则的后续步骤；若需容错可选择忽略错误继续。"
          label="失败处理"
        >
          <OnErrorSelect value={draft.onError} onChange={updateOnError} />
        </DraftField>
      </ReferenceScopeProvider>
    </DraftModal>
  );
}
