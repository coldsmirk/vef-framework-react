import type { DynamicIconName } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { ContainerNode, FieldDefinition, FormField, FormSchema, PropertiesDescriptor, PropertyEntry, PropertyTabId } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars, ScrollArea } from "@vef-framework-react/components";
import { Suspense, useMemo, useState } from "react";

import { findNodeWithParentContainer, isContainerNode, isLeafField } from "../../engine/schema/walk";
import { useFieldRegistry } from "../../store/engine-provider";
import { useCurrentLayer, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { useEditorLayout } from "../editor-layout-context";
import { panelBodyCss, propertiesDockCss } from "../styles";
import { BlockLayoutSection } from "./block-layout-section";
import { ContainerProperties } from "./container-properties";
import { BUILT_IN_PROPERTY_ENTRIES } from "./entries/built-ins";
import { PropertiesEmpty } from "./properties-empty";
import { PropertiesHeader } from "./properties-header";
import { buildPropertiesDescriptor, groupsForTab, PROPERTY_TAB_ORDER } from "./properties-provider";
import { PropertiesTabs } from "./properties-tabs";

const bodyInnerCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 22,
  padding: "22px 20px 24px"
});

const groupCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 14
});

const groupTitleCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorText,
  letterSpacing: 0,
  paddingBottom: 6,
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const groupEntriesCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 14
});

const entriesLoadingCss = css({
  padding: "10px 0",
  color: globalCssVars.colorTextTertiary,
  fontSize: globalCssVars.fontSizeSm
});

const unknownEntryCss = css({
  padding: "10px 12px",
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorWarningBg,
  color: globalCssVars.colorWarningText,
  fontSize: globalCssVars.fontSize
});

interface TabEmptyHint {
  title: string;
  hint: string;
  icon: DynamicIconName;
}

const TAB_EMPTY_FALLBACK: TabEmptyHint = {
  title: "暂无可配置项",
  hint: "当前字段在该标签下尚未注册任何编辑项。",
  icon: "settings-2"
};

/**
 * Per-tab empty hints, keyed by {@link PropertyTabId}. A tab without an entry
 * (e.g. "layout", which renders its own control rather than descriptor groups)
 * falls back to {@link TAB_EMPTY_FALLBACK}.
 */
const EMPTY_TAB_HINTS: Partial<Record<PropertyTabId, TabEmptyHint>> = {
  props: {
    title: "暂无属性",
    hint: "当前字段尚未注册任何属性编辑器。",
    icon: "sliders-horizontal"
  },
  validation: {
    title: "无校验规则",
    hint: "当前字段类型未暴露可配置的校验项；如需校验，请回到「属性」面板调整。",
    icon: "shield-check"
  },
  linkage: {
    title: "暂无联动配置",
    hint: "为字段添加显示、禁用或赋值联动后会出现在此处。",
    icon: "link-2"
  }
};

/**
 * Docked properties workbench on the right edge of the workspace — the mirror of
 * the component palette. It is permanent in edit mode and hidden during
 * preview / json mode; a selected field or container shows its property editor,
 * an empty selection shows a "pick a control" hint.
 *
 * Layout when a field is selected:
 * - header: type icon + field label + field id + deselect button
 * - tabs: 属性 / 校验 / 联动 with count badges, plus a contextual 布局 tab
 * appended only when the field sits inside a flex / grid container
 * - body: scrollable, renders groups assigned to the active tab
 *
 * Empty / error states:
 * - nothing selected → "未选择控件"
 * - selected field's type is unknown → "未知字段类型"
 */
export function PropertiesPanel(): ReactElement {
  const isEditing = useFormEditorStore(s => s.viewMode === "edit");
  const selectedId = useFormEditorStore(s => s.selectedId);
  const schema = useFormEditorStore(s => s.schema);
  const layer = useCurrentLayer();
  const registry = useFieldRegistry();
  const storeApi = useFormEditorStoreApi();
  const layout = useEditorLayout();

  const [activeTab, setActiveTab] = useState<PropertyTabId>("props");

  // Resolve the selected node and its owning container in a single tree walk —
  // both are read on every property keystroke.
  const located = useMemo(
    () => selectedId ? findNodeWithParentContainer(layer, selectedId) : undefined,
    [layer, selectedId]
  );
  const node = located?.node;

  const field: FormField | undefined = node && isLeafField(node) ? node : undefined;
  const container = node && isContainerNode(node) ? node : undefined;

  const definition: FieldDefinition | undefined = field
    ? registry.get(field.type)
    : undefined;

  const descriptor = useMemo(() => {
    if (!definition) {
      return [];
    }

    return buildPropertiesDescriptor(definition);
  }, [definition]);

  // Layout sizing (flex grow / basis, grid span) only exists for a field that
  // lives inside a flex / grid container, so the "布局" tab is contextual: shown
  // only then, and dropped otherwise rather than left as a perpetually-empty tab.
  // `located.parent` is the field's owning container from the same walk above.
  const layoutParent = field ? located?.parent : undefined;
  const showLayout = layoutParent?.type === "flex" || layoutParent?.type === "grid";
  const tabs = useMemo(
    () => showLayout ? PROPERTY_TAB_ORDER : PROPERTY_TAB_ORDER.filter(tab => tab !== "layout"),
    [showLayout]
  );
  // Resolve away a stale selection (e.g. left on "布局", then a field outside any
  // layout container is selected) so the body never renders a hidden tab.
  const resolvedTab = tabs.includes(activeTab) ? activeTab : "props";

  // The dock is permanent, so clearing the selection just reverts it to the
  // empty hint (there is no panel to close); the canvas highlight clears with
  // the selection.
  const deselect = (): void => {
    storeApi.getState().selectNode(null);
  };

  const handleChange = (entry: PropertyEntry, value: unknown): void => {
    if (!field) {
      return;
    }

    // The data-binding key needs value-scope context (non-empty fallback +
    // per-scope uniqueness) that a field-level write lens cannot provide, so
    // route it to the dedicated store action.
    if (entry.id === "key" && typeof value === "string") {
      storeApi.getState().setFieldKey({ fieldId: field.id, key: value });
      return;
    }

    // Coalesce per entry, not per field: a run of keystrokes in one entry's
    // input folds into a single undo step, while moving on to another entry
    // (label → placeholder) starts a fresh one.
    storeApi.getState().editField(
      { fieldId: field.id, updater: current => entry.write(current, value) },
      { coalesceKey: `field:${field.id}:${entry.id}` }
    );
  };

  // Resolve the body with early-outs rather than a 4-level nested ternary:
  // container → nothing selected → unknown field type → the field editor.
  let content: ReactElement;

  if (container) {
    content = <ContainerProperties node={container} parent={located?.parent} onClose={deselect} />;
  } else if (!field) {
    content = (
      <PropertiesEmpty
        hint="在画布中点选一个控件，在这里编辑它的属性。"
        icon="mouse-pointer-2"
        title="未选择控件"
      />
    );
  } else if (definition) {
    content = (
      <>
        <PropertiesHeader
          definition={definition}
          field={field}
          onClose={deselect}
        />

        <PropertiesTabs
          activeTab={resolvedTab}
          descriptor={descriptor}
          field={field}
          tabs={tabs}
          onChange={setActiveTab}
        />

        <ScrollArea css={panelBodyCss}>
          <div css={bodyInnerCss}>
            <TabContent
              activeTab={resolvedTab}
              descriptor={descriptor}
              field={field}
              parent={located?.parent}
              schema={schema}
              onChange={handleChange}
            />
          </div>
        </ScrollArea>
      </>
    );
  } else {
    content = (
      <ScrollArea css={panelBodyCss}>
        <PropertiesEmpty
          hint={`字段类型 "${field.type}" 未在当前 registry 中注册`}
          icon="circle-help"
          title="未知字段类型"
        />
      </ScrollArea>
    );
  }

  // In the drawer layout the panel is a floating overlay over the canvas's
  // right edge; with nothing selected it stays away entirely so the narrow
  // host keeps every pixel for the canvas (the empty hint earns no overlay).
  const hidden = !isEditing || (layout === "drawer" && node === undefined);

  return (
    <aside aria-label="属性" css={propertiesDockCss} data-layout={layout} hidden={hidden}>
      {content}
    </aside>
  );
}

interface TabContentProps {
  activeTab: PropertyTabId;
  field: FormField;
  /**
   * The field's owning container from the panel's fused walk — consumed by the
   * "布局" tab's sizing control.
   */
  parent: ContainerNode | undefined;
  descriptor: PropertiesDescriptor;
  schema: FormSchema;
  onChange: (entry: PropertyEntry, value: unknown) => void;
}

function TabContent({
  activeTab,
  descriptor,
  field,
  parent,
  schema,
  onChange
}: TabContentProps): ReactElement | null {
  const registry = useFieldRegistry();

  // The contextual "布局" tab renders its own sizing control (flex grow / basis,
  // grid span) rather than descriptor-driven property groups.
  if (activeTab === "layout") {
    return <BlockLayoutSection node={field} parent={parent} />;
  }

  const groups = groupsForTab(descriptor, activeTab);

  if (groups.length === 0) {
    const hint = EMPTY_TAB_HINTS[activeTab] ?? TAB_EMPTY_FALLBACK;
    return (
      <PropertiesEmpty
        hint={hint.hint}
        icon={hint.icon}
        title={hint.title}
      />
    );
  }

  return (
    // One boundary for the tab: the linkage entry is a lazy chunk (it anchors
    // CodeMirror), so its first open shows this hint instead of a blank panel.
    <Suspense fallback={<div css={entriesLoadingCss}>正在加载属性编辑器…</div>}>
      {groups.map(group => (
        <div key={group.id} css={groupCss}>
          {group.label.length > 0 ? <div css={groupTitleCss}>{group.label}</div> : null}

          <div css={groupEntriesCss}>
            {group.entries.map(entry => {
              if (entry.visible && !entry.visible(field)) {
                return null;
              }

              // Instance registrations (host overrides / augmented types)
              // win; the statically bundled built-ins are the fallback.
              const Entry = registry.getPropertyEntry(entry.type) ?? BUILT_IN_PROPERTY_ENTRIES[entry.type];

              if (!Entry) {
                return (
                  <div key={entry.id} css={unknownEntryCss} data-unknown-entry-type={entry.type}>
                    未注册的属性编辑器：
                    {entry.type}
                  </div>
                );
              }

              return (
                <Entry
                  key={entry.id}
                  entry={entry}
                  field={field}
                  schema={schema}
                  onChange={(value: unknown) => onChange(entry, value)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </Suspense>
  );
}
