import type { ReactElement } from "react";

import type { ContainerNode, FieldLinkage, LinkageTriggerKind } from "../../../../types";

import { isKeyedNode } from "../../../../engine/keys";
import { nodeLabel } from "../../../../engine/schema/walk";
import { useFormEditorStoreApi } from "../../../../store/form-store";
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
const NO_TRIGGER_KINDS: readonly LinkageTriggerKind[] = [];

const CONTAINER_FALLBACK_LABELS: Record<ContainerNode["type"], string> = {
  section: "卡片 / 区块",
  tabs: "标签页",
  subform: "子表单",
  flex: "弹性布局",
  grid: "栅格布局"
};

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
  const linkage = readLinkage(node.linkage);
  const rules = linkage.rules ?? [];

  // A container references the scope it RESIDES in (a subform node references
  // its outer siblings; its template children open their own scope), mirroring
  // the validator's resolution.
  const { issuesByRule, scope } = useLinkageEditorModel(node.id);

  const seedSourceKey = scope.fieldOptions[0]?.value;
  // Without a keyed field in scope a condition rule cannot be seeded (an
  // empty condition group is never authored), so rule creation is disabled
  // with an explanation; defaults stay editable either way.
  const addDisabledReason = seedSourceKey === undefined
    ? "当前作用域内没有可引用的字段，请先添加带数据绑定的字段"
    : undefined;
  const triggerKinds = seedSourceKey === undefined ? NO_TRIGGER_KINDS : CONTAINER_TRIGGER_KINDS;
  const ownerLabel = nodeLabel(node) ?? (isKeyedNode(node) ? node.key : undefined) ?? CONTAINER_FALLBACK_LABELS[node.type];

  const commit = (next: FieldLinkage): void => {
    const normalized = normalizeLinkage(next);

    // Every linkage change is a discrete commit (modal save, duplicate, delete,
    // or default toggle) — omit coalesceKey so consecutive actions stay
    // distinct undo steps.
    storeApi.getState().updateBlock({
      nodeId: node.id,
      updater: current => { return { ...current, linkage: normalized }; }
    });
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
        issuesByRule={issuesByRule}
        isTargetKeyed={false}
        noun="联动"
        ownerLabel={ownerLabel}
        ownerNodeId={node.id}
        rules={rules}
        scope={scope}
        triggerKinds={triggerKinds}
        onChange={next => commit({ ...linkage, rules: next })}
      />
    </div>
  );
}
