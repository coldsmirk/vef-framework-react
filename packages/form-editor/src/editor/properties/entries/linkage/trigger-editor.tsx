import type { FC } from "react";

import type { FormVariable, LinkageTrigger, LinkageTriggerKind } from "../../../../types";
import type { SourceFieldOption } from "./options";

import { css } from "@emotion/react";
import { Button, globalCssVars, Popconfirm, Select, Switch } from "@vef-framework-react/components";

import { EditorIcon } from "../../../../icons";
import { useContextSources } from "../../../context-sources";
import { useConfirmableKindSwitch } from "../../use-confirmable-kind-switch";
import { ConditionEditor } from "./condition-editor";
import { createGroup, createLeaf, createTrigger } from "./mutators";
import { isLinkageTriggerKind, seedSourceKey, triggerOptionsFor } from "./options";
import {
  actionRetriggerCss,
  actionRetriggerLabelCss,
  addInlineButtonCss,
  defaultHintCss,
  defaultTextCss,
  sectionCss,
  sectionLabelCss,
  selectStyle,
  triggerHintCss
} from "./styles";

/**
 * Plain-language description of each edge trigger. `commit` is overridden per
 * control via `commitHint` (entry fields vs textarea vs switch vs pickers) so
 * the description always matches how the control actually commits at runtime.
 */
const TRIGGER_HINTS: Partial<Record<LinkageTriggerKind, string>> = {
  change: "当该字段的值发生变化时触发",
  commit: "输入完成时触发",
  focus: "当该字段获得焦点时触发",
  blur: "当该字段失去焦点时触发",
  click: "当点击该字段时触发",
  load: "当表单加载完成时触发",
  beforeSubmit: "当表单提交前触发",
  afterSubmit: "当表单提交成功后触发"
};

const guardSectionCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6
});

const guardHeaderCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8
});

const guardTitleCss = css({
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary
});

const EMPTY_VARIABLES: readonly FormVariable[] = [];

export interface TriggerEditorProps {
  trigger: LinkageTrigger;
  /**
   * Trigger kinds offered, by scope (field vs form).
   */
  triggerKinds: readonly LinkageTriggerKind[];
  sourceOptions: SourceFieldOption[];
  /**
   * Form-global variables forwarded to the condition / event-guard picker.
   */
  variables?: readonly FormVariable[];
  /**
   * Control-specific description of the `commit` trigger ("输入完成时").
   */
  commitHint?: string;
  /**
   * The owning block's data-binding key, forwarded so condition builders and
   * event guards seed sensible sources.
   */
  selfKey?: string;
  /**
   * Whether the rule contains any effect actions (controls whether the
   * rule-level `retrigger` toggle shows for a `condition` trigger).
   */
  hasEffectActions?: boolean;
  /**
   * Whether switching away from the current trigger discards real work (e.g.
   * state actions that must be stripped when leaving a `condition` trigger).
   */
  confirmKindSwitch: boolean;
  onChange: (next: LinkageTrigger) => void;
  /**
   * Optional rule-level trigger-kind switcher that preserves still-applicable
   * guards (`when` ↔ `condition`) across switches. Falls back to `createTrigger`
   * when rendered standalone.
   */
  onKindSwitch?: (nextKind: LinkageTriggerKind) => void;
}

/**
 * The WHEN half of a rule: a trigger-kind picker plus, for a `condition`
 * trigger, the visual condition builder (and rule-level `retrigger` toggle when
 * the rule carries effect actions) — or, for an edge (event) trigger, a
 * control-accurate description and an optional `when` guard condition.
 */
export const TriggerEditor: FC<TriggerEditorProps> = ({
  commitHint,
  confirmKindSwitch,
  hasEffectActions = false,
  onChange,
  onKindSwitch,
  selfKey,
  sourceOptions,
  trigger,
  triggerKinds,
  variables = EMPTY_VARIABLES
}) => {
  const contextSources = useContextSources();
  const kindSwitch = useConfirmableKindSwitch<LinkageTriggerKind>({
    current: trigger.kind,
    needsConfirm: confirmKindSwitch,
    commit: kind => {
      if (onKindSwitch !== undefined) {
        onKindSwitch(kind);
        return;
      }

      onChange(createTrigger(kind, seedSourceKey(sourceOptions, selfKey) ?? sourceOptions[0]?.value));
    }
  });

  const guardSeed = selfKey
    ?? sourceOptions[0]?.value
    ?? (variables[0]?.name ? `$vars.${variables[0].name}` : undefined)
    ?? contextSources[0]?.key;

  const edgeHint = trigger.kind === "commit"
    ? (commitHint ?? TRIGGER_HINTS.commit)
    : TRIGGER_HINTS[trigger.kind];

  return (
    <div css={sectionCss}>
      <span css={sectionLabelCss}>WHEN</span>

      <Popconfirm
        cancelText="取消"
        okText="切换"
        open={kindSwitch.pendingKind !== null}
        title="切换触发方式将移除状态类动作"
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
                variables={variables}
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
        : (
            <>
              <div css={triggerHintCss}>{edgeHint}</div>

              {trigger.when === undefined
                ? (
                    <Button
                      css={addInlineButtonCss}
                      disabled={guardSeed === undefined}
                      icon={<EditorIcon name="plus" />}
                      size="small"
                      type="dashed"
                      onClick={() => {
                        if (guardSeed === undefined) {
                          return;
                        }

                        onChange({
                          ...trigger,
                          when: createGroup([createLeaf(guardSeed, "notEmpty")])
                        });
                      }}
                    >
                      添加执行条件
                    </Button>
                  )
                : (
                    <div css={guardSectionCss}>
                      <div css={guardHeaderCss}>
                        <span css={guardTitleCss}>仅在满足条件时执行</span>

                        <Button
                          size="small"
                          type="text"
                          onClick={() => {
                            const next = { ...trigger };
                            delete next.when;
                            onChange(next);
                          }}
                        >
                          移除条件
                        </Button>
                      </div>

                      <ConditionEditor
                        condition={trigger.when}
                        selfKey={selfKey}
                        sourceOptions={sourceOptions}
                        variables={variables}
                        onChange={when => onChange({ ...trigger, when })}
                      />
                    </div>
                  )}
            </>
          )}
    </div>
  );
};
