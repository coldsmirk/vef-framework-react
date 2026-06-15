import type { ReactElement } from "react";

import type { ContainerNode, FieldLinkage, LinkageTriggerKind } from "../../../../types";

import { useCurrentLayer, useFormEditorStore, useFormEditorStoreApi } from "../../../../store/form-store";
import { DefaultsPanel } from "./linkage-rules-entry";
import { createRule, normalizeLinkage } from "./mutators";
import { RuleListEditor } from "./rule-list-editor";
import { rootCss, titleCss } from "./styles";
import { useLinkageEditorModel } from "./use-linkage-editor-model";

/**
 * Containers only react to level signals: `change` rides a keyed leaf's
 * onChange (the validator rejects it elsewhere via
 * `trigger_requires_keyed_leaf`), and the remaining field edges are DOM hooks
 * a container body never dispatches — so the palette is `condition` only.
 */
const CONTAINER_TRIGGER_KINDS: readonly LinkageTriggerKind[] = ["condition"];
// A stable empty list for the no-source case (vs a fresh `[]` per render), so it
// never busts the rule cards' memo.
const NO_TRIGGER_KINDS: readonly LinkageTriggerKind[] = [];

function readLinkage(value: FieldLinkage | undefined): FieldLinkage {
  return value ?? {};
}

export interface ContainerLinkageSectionProps {
  node: ContainerNode;
}

/**
 * Linkage editor for a container node (section / tabs / subform / flex /
 * grid) — the container counterpart of the field-level `LinkageRulesEntry`.
 * The model, validator, and runtime all support container linkage (`show` /
 * `hide` / `enable` / `disable` propagate to descendants); this section makes
 * it authorable. Rules are `condition`-triggered, the state palette is the
 * container subset, and writes go through the store's `updateBlock`.
 */
export function ContainerLinkageSection({ node }: ContainerLinkageSectionProps): ReactElement {
  const storeApi = useFormEditorStoreApi();
  const layer = useCurrentLayer();
  const dataSources = useFormEditorStore(state => state.schema.dataSources);
  const variables = useFormEditorStore(state => state.schema.variables);
  const linkage = readLinkage(node.linkage);
  const rules = linkage.rules ?? [];

  // Same-scope keyed leaf fields feed both the condition source and the
  // `set_field` target — a container references the scope it RESIDES in (a
  // subform node references its outer siblings; its template children open
  // their own scope), mirroring the validator's resolution.
  const {
    dataSourceOptions,
    fieldOptions,
    issuesByRule,
    variableNames
  } = useLinkageEditorModel({
    layer,
    nodeId: node.id,
    dataSources,
    variables
  });

  const seedSourceKey = fieldOptions[0]?.value;
  // Without a keyed field in scope a condition rule cannot be seeded (an
  // empty condition group is never authored), so rule creation is disabled
  // with an explanation; defaults stay editable either way.
  const addDisabledReason = seedSourceKey === undefined
    ? "当前作用域内没有可引用的字段，请先添加带数据绑定的字段"
    : undefined;
  const triggerKinds = seedSourceKey === undefined ? NO_TRIGGER_KINDS : CONTAINER_TRIGGER_KINDS;

  const commit = (next: FieldLinkage): void => {
    const normalized = normalizeLinkage(next);

    storeApi.getState().updateBlock(
      { nodeId: node.id, updater: current => { return { ...current, linkage: normalized }; } },
      { coalesceKey: `block:${node.id}:linkage` }
    );
  };

  return (
    <div css={rootCss}>
      <span css={titleCss}>联动规则</span>

      <DefaultsPanel
        defaults={linkage.defaults}
        isTargetKeyed={false}
        onChange={(key, value) => commit({ ...linkage, defaults: { ...linkage.defaults, [key]: value } })}
      />

      <RuleListEditor
        allowStateActions
        isContainerTarget
        addDisabledReason={addDisabledReason}
        createRule={() => createRule(seedSourceKey, false)}
        dataSourceOptions={dataSourceOptions}
        issuesByRule={issuesByRule}
        isTargetKeyed={false}
        noun="联动"
        rules={rules}
        sourceOptions={fieldOptions}
        targetOptions={fieldOptions}
        triggerKinds={triggerKinds}
        variableNames={variableNames}
        onChange={next => commit({ ...linkage, rules: next })}
      />
    </div>
  );
}
