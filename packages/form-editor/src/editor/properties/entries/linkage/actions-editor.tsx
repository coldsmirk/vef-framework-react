import type { FC } from "react";

import type { FieldLinkageAction, LinkageTriggerKind } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { Button } from "@vef-framework-react/components";
import { useMemo } from "react";

import { EditorIcon } from "../../../../icons";
import { usePreviewRuntime } from "../../../preview-runtime-context";
import { ActionEditor } from "./action-editor";
import { createActionFor } from "./mutators";
import { actionOptionsFor } from "./options";
import { actionsListCss, addInlineButtonCss, sectionCss, sectionLabelCss } from "./styles";

export interface ActionsEditorProps {
  actions: FieldLinkageAction[];
  triggerKind: LinkageTriggerKind;
  isTargetKeyed: boolean;
  allowStateActions: boolean;
  isContainerTarget?: boolean;
  targetOptions: SourceFieldOption[];
  dataSourceOptions: SourceFieldOption[];
  onChange: (next: FieldLinkageAction[]) => void;
}

export const ActionsEditor: FC<ActionsEditorProps> = ({
  actions,
  allowStateActions,
  dataSourceOptions,
  isContainerTarget = false,
  isTargetKeyed,
  targetOptions,
  triggerKind,
  onChange
}) => {
  const { serviceCapabilities } = usePreviewRuntime();
  const hasRequest = serviceCapabilities?.hasRequest;
  const hasNavigate = serviceCapabilities?.hasNavigate;

  const availableActions = useMemo(
    () => actionOptionsFor({
      triggerKind,
      isTargetKeyed,
      allowStateActions,
      isContainerTarget,
      hasRequest,
      hasNavigate
    }),
    [triggerKind, isTargetKeyed, allowStateActions, isContainerTarget, hasRequest, hasNavigate]
  );

  const updateAt = (index: number, next: FieldLinkageAction): void => {
    onChange(actions.map((action, current) => current === index ? next : action));
  };

  const removeAt = (index: number): void => {
    onChange(actions.filter((_, current) => current !== index));
  };

  const addAction = (): void => {
    const seed = availableActions[0]?.value;

    if (seed) {
      onChange([...actions, createActionFor(seed)]);
    }
  };

  return (
    <div css={sectionCss}>
      <span css={sectionLabelCss}>THEN</span>

      <div css={actionsListCss}>
        {actions.map((action, index) => (
          <ActionEditor
            key={action.id ?? index}
            action={action}
            availableActions={availableActions}
            canRemove={actions.length > 1}
            dataSourceOptions={dataSourceOptions}
            targetOptions={targetOptions}
            onChange={next => updateAt(index, next)}
            onRemove={() => removeAt(index)}
          />
        ))}
      </div>

      <Button
        css={addInlineButtonCss}
        disabled={availableActions.length === 0}
        icon={<EditorIcon name="plus" />}
        size="small"
        type="dashed"
        onClick={addAction}
      >
        新增动作
      </Button>
    </div>
  );
};
