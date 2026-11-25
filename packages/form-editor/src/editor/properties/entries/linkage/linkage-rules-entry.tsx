import type { FC } from "react";

import type { EntryComponentProps, FieldDefinition, FieldLinkage, FieldLinkageDefaults, FormField } from "../../../../types";

import { Switch } from "@vef-framework-react/components";
import { useMemo } from "react";

import { isKeyedField } from "../../../../engine/keys";
import { FIELD_TRIGGER_KINDS } from "../../../../engine/linkage";
import { useOptionalFieldRegistry } from "../../../../store/engine-provider";
import { useCurrentLayer } from "../../../../store/form-store";
import { usePreviewRuntime } from "../../../preview-runtime-context";
import { createRule, normalizeLinkage } from "./mutators";
import { seedSourceKey } from "./options";
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
import { buildFieldLinkageTemplates } from "./templates";
import { useLinkageEditorModel } from "./use-linkage-editor-model";

export type DefaultsKey = keyof FieldLinkageDefaults;

function readLinkage(value: unknown): FieldLinkage {
  return value && typeof value === "object" ? value as FieldLinkage : {};
}

/**
 * Plain-Chinese description of the `commit` ("输入完成时") trigger tailored to
 * the control's actual runtime commit semantics, instead of a one-size-fits-all
 * "回车或离开".
 */
export function commitHintForField(field: FormField, definition: FieldDefinition | undefined): string {
  if (field.type === "textarea") {
    return "离开输入框且内容变化时触发";
  }

  if (definition?.config.commit === "entry" || field.type === "textfield" || field.type === "number") {
    return "按回车或离开输入框且内容变化时触发";
  }

  if (field.type === "switch") {
    return "切换开关状态后触发";
  }

  if (field.type === "upload") {
    return "文件变更后触发";
  }

  if (field.type === "code-editor") {
    return "内容变化后触发";
  }

  return "每次选择后触发";
}

export const LinkageRulesEntry: FC<EntryComponentProps> = ({
  entry,
  field,
  schema,
  onChange
}) => {
  const layer = useCurrentLayer();
  const registry = useOptionalFieldRegistry();
  const { serviceCapabilities } = usePreviewRuntime();
  const linkage = readLinkage(entry.read(field));
  const rules = linkage.rules ?? [];
  const isTargetKeyed = isKeyedField(field);
  // Field options, data-source options, variables, and deferred rule
  // diagnostics — resolved in the target field's own value scope (a subform
  // field references its row siblings, not the outer form).
  const {
    dataSourceOptions,
    dataSources,
    fieldOptions,
    issuesByRule,
    scopeFieldsByKey,
    targetOptions,
    variables,
    writableTargets
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
  const seedKey = seedSourceKey(fieldOptions, selfKey);
  const commitHint = useMemo(
    () => commitHintForField(field, registry?.get(field.type)),
    [field, registry]
  );
  const templates = useMemo(
    () => buildFieldLinkageTemplates({ field, hasRequest: serviceCapabilities?.hasRequest }),
    [field, serviceCapabilities?.hasRequest]
  );
  // Drop trigger kinds the target can't actually use, rather than letting an
  // author configure a silently-inert (and validator-rejected) rule:
  // - `change` and `commit` ride a keyed field's value edits, so a non-keyed
  //   field (divider / alert / button) can never fire them.
  // - `condition` with no keyed field in scope yields an empty group the
  //   validator rejects and the visual builder can't repair.
  // Memoized to a stable reference so it does not bust the rule cards' memo
  // each keystroke (`fieldOptions` is itself identity-stable — see useStableOptions).
  const triggerKinds = useMemo(
    () => FIELD_TRIGGER_KINDS.filter(kind => {
      if (kind === "change" || kind === "commit") {
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
        commitHint={commitHint}
        // No sibling source seeds an edge rule; the edge must suit the target,
        // so pass whether it's keyed (a non-keyed block can't fire `change`).
        createRule={() => createRule(seedKey, isTargetKeyed)}
        dataSourceOptions={dataSourceOptions}
        dataSources={dataSources}
        issuesByRule={issuesByRule}
        isTargetKeyed={isTargetKeyed}
        noun="联动"
        ownerField={field}
        rules={rules}
        scopeFieldsByKey={scopeFieldsByKey}
        scopeNodeId={field.id}
        selfKey={selfKey}
        sourceOptions={fieldOptions}
        targetOptions={targetOptions}
        templates={templates}
        triggerKinds={triggerKinds}
        variables={variables}
        writableTargets={writableTargets}
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
