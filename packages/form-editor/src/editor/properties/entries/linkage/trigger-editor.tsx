import type { FC } from "react";

import type { LinkageTrigger, LinkageTriggerKind } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { Popconfirm, Select, Switch } from "@vef-framework-react/components";

import { useConfirmableKindSwitch } from "../../use-confirmable-kind-switch";
import { ConditionEditor } from "./condition-editor";
import { createTrigger } from "./mutators";
import { isLinkageTriggerKind, seedSourceKey, triggerOptionsFor } from "./options";
import {
  actionRetriggerCss,
  actionRetriggerLabelCss,
  defaultHintCss,
  defaultTextCss,
  sectionCss,
  sectionLabelCss,
  selectStyle,
  triggerHintCss
} from "./styles";

const TRIGGER_HINTS: Partial<Record<LinkageTriggerKind, string>> = {
  change: "当该字段的值发生变化时触发",
  commit: "回车或离开时触发",
  focus: "当该字段获得焦点时触发",
  blur: "当该字段失去焦点时触发",
  click: "当点击该字段时触发",
  load: "当表单加载完成时触发",
  beforeSubmit: "当表单提交前触发",
  afterSubmit: "当表单提交成功后触发"
};

export interface TriggerEditorProps {
  trigger: LinkageTrigger;
  triggerKinds: readonly LinkageTriggerKind[];
  sourceOptions: SourceFieldOption[];
  selfKey?: string;
  /**
   * Whether the rule contains any effect actions (controls whether the
   * rule-level `retrigger` toggle shows for a `condition` trigger).
   */
  hasEffectActions?: boolean;
  confirmKindSwitch: boolean;
  onChange: (next: LinkageTrigger) => void;
}

export const TriggerEditor: FC<TriggerEditorProps> = ({
  confirmKindSwitch,
  hasEffectActions = false,
  trigger,
  triggerKinds,
  sourceOptions,
  selfKey,
  onChange
}) => {
  const kindSwitch = useConfirmableKindSwitch<LinkageTriggerKind>({
    current: trigger.kind,
    needsConfirm: confirmKindSwitch,
    commit: kind => onChange(createTrigger(kind, seedSourceKey(sourceOptions, selfKey) ?? sourceOptions[0]?.value))
  });

  return (
    <div css={sectionCss}>
      <span css={sectionLabelCss}>WHEN</span>

      <Popconfirm
        cancelText="取消"
        okText="切换"
        open={kindSwitch.pendingKind !== null}
        title="切换触发方式将丢弃当前条件配置"
        onCancel={kindSwitch.cancel}
        onConfirm={kindSwitch.confirm}
      >
        <Select
          options={triggerOptionsFor(triggerKinds)}
          style={selectStyle}
          value={trigger.kind}
          onChange={value => {
            if (isLinkageTriggerKind(value)) {
              kindSwitch.requestKind(value);
            }
          }}
        />
      </Popconfirm>

      {trigger.kind === "condition"
        ? (
            <>
              <ConditionEditor
                condition={trigger.condition}
                selfKey={selfKey}
                sourceOptions={sourceOptions}
                onChange={condition => onChange({ ...trigger, condition })}
              />

              {hasEffectActions
                ? (
                    <div css={actionRetriggerCss}>
                      <div css={defaultTextCss}>
                        <span css={actionRetriggerLabelCss}>重复触发</span>

                        <span css={defaultHintCss}>
                          条件持续满足期间，依赖字段每次变化都重新触发；关闭（默认）则仅在条件首次满足时触发一次。
                        </span>
                      </div>

                      <Switch
                        aria-label="重复触发"
                        checked={trigger.retrigger === "always"}
                        size="small"
                        onChange={checked => {
                          if (checked) {
                            onChange({ ...trigger, retrigger: "always" });
                            return;
                          }

                          const next = { ...trigger };
                          delete next.retrigger;
                          onChange(next);
                        }}
                      />
                    </div>
                  )
                : null}
            </>
          )
        : <div css={triggerHintCss}>{TRIGGER_HINTS[trigger.kind]}</div>}
    </div>
  );
};
