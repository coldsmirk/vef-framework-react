import type { FC } from "react";

import type { FieldLinkageAction, LinkageTriggerKind } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { Button } from "@vef-framework-react/components";
import { useMemo } from "react";

import { EditorIcon } from "../../../../icons";
import { ActionEditor } from "./action-editor";
import { createActionFor } from "./mutators";
import { actionOptionsFor } from "./options";
import { actionsListCss, addInlineButtonCss, sectionCss, sectionLabelCss } from "./styles";

export interface ActionsEditorProps {
  actions: FieldLinkageAction[];
  /**
   * The rule's trigger kind — selects the action palette (state actions are
   * offered only under a `condition` trigger).
   */
  triggerKind: LinkageTriggerKind;
  isTargetKeyed: boolean;
  /**
   * Whether this scope permits state actions at all (field scope yes, form
   * scope no — the form has no self field whose state could be derived).
   */
  allowStateActions: boolean;
  /**
   * Whether the rule's target is a container — narrows the state palette to
   * the actions a container supports (`show` / `hide` / `enable` / `disable`).
   */
  isContainerTarget?: boolean;
  /**
   * Keyed fields offered as a `set_field` target.
   */
  targetOptions: SourceFieldOption[];
  /**
   * Form-global data sources offered as a `refresh_data_source` target.
   */
  dataSourceOptions: SourceFieldOption[];
  onChange: (next: FieldLinkageAction[]) => void;
}

/**
 * The THEN half of a rule: an ordered, add/remove list of actions. The palette
 * is derived from the trigger kind and the target's keyed-ness, so an edge
 * trigger can only add effect actions and a non-keyed target hides keyed-only
 * state actions.
 */
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
  const availableActions = useMemo(
    () => actionOptionsFor({
      triggerKind,
      isTargetKeyed,
      allowStateActions,
      isContainerTarget
    }),
    [triggerKind, isTargetKeyed, allowStateActions, isContainerTarget]
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
            // Keyed by the action's client-stable id so removing a middle action
            // keeps each editor pinned to its logical action; index is a fallback
            // for legacy actions authored before ids existed.
            key={action.id ?? index}
            action={action}
            availableActions={availableActions}
            canRemove={actions.length > 1}
            dataSourceOptions={dataSourceOptions}
            isConditionTrigger={triggerKind === "condition"}
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
