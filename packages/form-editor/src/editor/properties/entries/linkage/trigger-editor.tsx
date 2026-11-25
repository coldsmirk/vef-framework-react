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

/**
 * Plain-language description of each edge trigger, shown in place of the
 * condition builder when the trigger has no value to compare against.
 */
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
  /**
   * Trigger kinds offered, by scope (field vs form).
   */
  triggerKinds: readonly LinkageTriggerKind[];
  sourceOptions: SourceFieldOption[];
  /**
   * The owning block's data-binding key, forwarded so the expression → visual
   * switch seeds with a different field when one exists.
   */
  selfKey?: string;
  /**
   * Whether the rule contains any effect actions (controls whether the
   * rule-level `retrigger` toggle shows for a `condition` trigger).
   */
  hasEffectActions?: boolean;
  /**
   * Whether switching away from the current trigger discards real work (an
   * authored condition tree, or state actions the reconcile step would strip).
   * When set, the kind switch is gated behind a confirmation; an unconfigured
   * trigger switches instantly.
   */
  confirmKindSwitch: boolean;
  onChange: (next: LinkageTrigger) => void;
}

/**
 * The WHEN half of a rule: a trigger-kind picker plus, for a `condition`
 * trigger, the visual condition builder (and rule-level `retrigger` toggle when
 * the rule carries effect actions) — or a one-line hint for an edge (event)
 * trigger, which needs no value to compare against.
 */
export const TriggerEditor: FC<TriggerEditorProps> = ({
  confirmKindSwitch,
  hasEffectActions = false,
  trigger,
  triggerKinds,
  sourceOptions,
  selfKey,
  onChange
}) => {
  // Switching the trigger kind discards the authored condition / actions; the
  // Select stays on the current trigger until the user confirms (gated only
  // when there is real work to lose — `confirmKindSwitch`).
  const kindSwitch = useConfirmableKindSwitch<LinkageTriggerKind>({
    current: trigger.kind,
    needsConfirm: confirmKindSwitch,
    // Prefer a source other than the rule's own field, mirroring how a freshly
    // created rule and the visual-mode switch both seed: a self-referencing
    // condition is almost always a mistake. Self stays selectable afterwards.
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
                      {/* Title + persistent hint, mirroring the DefaultsPanel toggle rows,
                            so the consequential edge-vs-always behavior is explained inline
                            instead of hidden in a native (touch-invisible) tooltip. */}
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

                          // Turning the toggle off removes the key entirely (the default is
                          // "edge") so the persisted trigger stays minimal.
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
