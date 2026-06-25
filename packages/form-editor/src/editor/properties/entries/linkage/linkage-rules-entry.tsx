import type { FC } from "react";

import type { EntryComponentProps, FieldLinkage, FieldLinkageDefaults } from "../../../../types";

import { Switch } from "@vef-framework-react/components";
import { useMemo } from "react";

import { isKeyedField } from "../../../../engine/keys";
import { FIELD_TRIGGER_KINDS } from "../../../../engine/linkage";
import { useCurrentLayer } from "../../../../store/form-store";
import { createRule, normalizeLinkage } from "./mutators";
import { RuleListEditor } from "./rule-list-editor";
import {
  defaultHintCss,
  defaultStateCss,
  defaultStatesCss,
  defaultTextCss,
  defaultTitleCss,
  headerCss,
  hintCss,
  rootCss,
  titleCss
} from "./styles";
import { useLinkageEditorModel } from "./use-linkage-editor-model";

export type DefaultsKey = keyof FieldLinkageDefaults;

function readLinkage(value: unknown): FieldLinkage {
  return value && typeof value === "object" ? value as FieldLinkage : {};
}

export const LinkageRulesEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  schema,
  onChange
}) => {
  const layer = useCurrentLayer();
  const linkage = readLinkage(entry.read(field));
  const rules = linkage.rules ?? [];
  const isTargetKeyed = isKeyedField(field);
  // Field options, data-source options, variable names, and deferred rule
  // diagnostics — resolved in the target field's own value scope (a subform
  // field references its row siblings, not the outer form). The one field-option
  // list feeds both the condition source and the `set_field` target picker, and
  // includes the field itself — a rule may key off its own value.
  const {
    dataSourceOptions,
    fieldOptions,
    issuesByRule,
    variableNames
  } = useLinkageEditorModel({
    layer,
    nodeId: field.id,
    dataSources: schema.dataSources,
    variables: schema.variables
  });
  // Seed a new rule's condition off a SIBLING so it reads naturally; a field
  // whose only in-scope source is itself falls back to an edge rule rather than
  // a pre-filled self-condition (self stays selectable in the dropdown after).
  // Computed once and reused as the `selfKey` prop below.
  const selfKey = isKeyedField(field) ? field.key : undefined;
  const seedSourceKey = fieldOptions.find(option => option.value !== selfKey)?.value;
  // Drop trigger kinds the target can't actually use, rather than letting an
  // author configure a silently-inert (and validator-rejected) rule:
  // - `change` rides the keyed field's onChange, so a non-keyed field
  //   (divider / alert / button) can never fire it.
  // - `condition` with no keyed field in scope yields an empty group the
  //   validator rejects and the visual builder can't repair.
  // Memoized to a stable reference so it does not bust the rule cards' memo each
  // keystroke (`fieldOptions` is itself identity-stable — see useStableOptions).
  const triggerKinds = useMemo(
    () => FIELD_TRIGGER_KINDS.filter(kind => {
      if (kind === "change") {
        return isTargetKeyed;
      }

      if (kind === "condition") {
        return fieldOptions.length > 0;
      }

      return true;
    }),
    [fieldOptions, isTargetKeyed]
  );

  const commit = (next: FieldLinkage): void => {
    onChange(normalizeLinkage(next));
  };

  const updateDefault = (key: DefaultsKey, value: boolean): void => {
    commit({
      ...linkage,
      defaults: { ...linkage.defaults, [key]: value }
    });
  };

  return (
    <div css={rootCss}>
      <div css={headerCss}>
        <div>
          <div css={titleCss}>{entry.label}</div>
          {entry.description ? <div css={hintCss}>{entry.description}</div> : null}
        </div>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering */}
      <DefaultsPanel
        defaults={linkage.defaults}
        isTargetKeyed={isTargetKeyed}
        onChange={updateDefault}
      />

      <RuleListEditor
        allowStateActions
        // No sibling source seeds an edge rule; the edge must suit the target,
        // so pass whether it's keyed (a non-keyed block can't fire `change`).
        createRule={() => createRule(seedSourceKey, isTargetKeyed)}
        dataSourceOptions={dataSourceOptions}
        issuesByRule={issuesByRule}
        isTargetKeyed={isTargetKeyed}
        noun="联动"
        rules={rules}
        selfKey={selfKey}
        sourceOptions={fieldOptions}
        targetOptions={fieldOptions}
        triggerKinds={triggerKinds}
        variableNames={variableNames}
        onChange={next => commit({ ...linkage, rules: next })}
      />
    </div>
  );
};

export interface DefaultsPanelProps {
  defaults: FieldLinkageDefaults | undefined;
  isTargetKeyed: boolean;
  onChange: (key: DefaultsKey, value: boolean) => void;
}

/**
 * Renders the "默认状态" row. Order mirrors {@link FieldLinkageDefaults}:
 * hidden → disabled → required. `required` is only meaningful on keyed
 * leaf fields (the validator rejects it elsewhere), so the toggle is omitted
 * when the target is non-keyed; the container linkage section reuses the
 * panel with `isTargetKeyed=false` for the same reason.
 */
export const DefaultsPanel: FC<DefaultsPanelProps> = ({
  defaults,
  isTargetKeyed,
  onChange
}) => (
  <div css={defaultStatesCss}>
    {/* eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering */}
    <DefaultToggle
      checked={defaults?.hidden === true}
      hint="适合“满足规则后显示”的渐进式表单"
      title="默认隐藏"
      onChange={value => onChange("hidden", value)}
    />

    {/* eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering */}
    <DefaultToggle
      checked={defaults?.disabled === true}
      hint="适合“满足规则后才允许编辑”的场景"
      title="默认禁用"
      onChange={value => onChange("disabled", value)}
    />

    {isTargetKeyed
      ? (
          // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering
          <DefaultToggle
            checked={defaults?.required === true}
            hint="联动侧必填的初始值，规则的必填/选填动作可改写；与「校验」页的必填字段任一开启即必填"
            title="默认必填"
            onChange={value => onChange("required", value)}
          />
        )
      : null}
  </div>
);

interface DefaultToggleProps {
  checked: boolean;
  title: string;
  hint: string;
  onChange: (value: boolean) => void;
}

const DefaultToggle: FC<DefaultToggleProps> = ({
  checked,
  hint,
  title,
  onChange
}) => (
  <div css={defaultStateCss}>
    <div css={defaultTextCss}>
      <span css={defaultTitleCss}>{title}</span>
      <span css={defaultHintCss}>{hint}</span>
    </div>

    <Switch checked={checked} onChange={onChange} />
  </div>
);
