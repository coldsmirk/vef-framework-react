import type { DynamicIconName } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { PropertiesTabId } from "../../store/form-store";
import type { ContainerNode, FieldDefinition, FormField, FormSchema, PropertiesDescriptor, PropertyEntry, PropertyTabId } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, ScrollArea } from "@vef-framework-react/components";
import { Suspense, useEffect, useMemo, useState } from "react";

import { findNodeWithParentContainer, isContainerNode, isLeafField } from "../../engine/schema/walk";
import { EditorIcon } from "../../icons";
import { useFieldRegistry } from "../../store/engine-provider";
import { useCurrentLayer, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { useEditorLayout } from "../editor-layout-context";
import { panelBodyCss, propertiesDockCss, propertiesDrawerTriggerCss } from "../styles";
import { BlockLayoutSection } from "./block-layout-section";
import { ContainerProperties } from "./container-properties";
import { BUILT_IN_PROPERTY_ENTRIES } from "./entries/built-ins";
import { FormPropertiesTab } from "./form-properties-tab";
import { PropertiesEmpty } from "./properties-empty";
import { PropertiesHeader } from "./properties-header";
import { buildPropertiesDescriptor, groupsForTab, PROPERTY_TAB_ORDER } from "./properties-provider";
import { PropertiesTabs } from "./properties-tabs";

const topBarCss = css({
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 44,
  padding: "0 16px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`
});

// Compact, quiet segmented switch for the top-level `控件` / `表单` scope.
// Visually lighter than the underlined `PropertiesTabs` below so stacked
// controls never read as competing tab rows.
const scopeTrackCss = css({
  flex: 1,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 2,
  padding: 2,
  borderRadius: 8,
  background: globalCssVars.colorFillTertiary
});

const scopeTabCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 26,
  padding: "0 10px",
  border: "none",
  borderRadius: 6,
  background: "transparent",
  color: globalCssVars.colorTextSecondary,
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  lineHeight: 1,
  cursor: "pointer",
  transition: `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}, color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "&:hover:not(:disabled)": {
    color: globalCssVars.colorText
  },

  "&:disabled": {
    color: globalCssVars.colorTextQuaternary,
    cursor: "not-allowed"
  }
});

const scopeTabActiveCss = css({
  background: globalCssVars.colorBgContainer,
  color: globalCssVars.colorText,
  boxShadow: globalCssVars.shadowXxs
});

const collapseButtonCss = css({
  width: 28,
  height: 28,
  padding: 0,
  flexShrink: 0
});

const bodyInnerCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 22,
  padding: "22px 20px 24px",
  // Size from the panel, not the content. The panel body is a fixed-width
  // vertical surface (see the dock's `scrollbars="vertical"`), but the scroll
  // viewport's content track is otherwise content-sized: an intrinsically wide
  // descendant (a freshly mounted CodeMirror laying its line out before the flex
  // layout settles, a non-shrinking control row) would widen this track past the
  // panel and clip on the right. Inline-size containment caps the body at the
  // panel width so every descendant lays out within it.
  contain: "inline-size"
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
  hint: "此控件在这一页没有可配置的内容。",
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
    hint: "此控件没有可配置的属性。",
    icon: "sliders-horizontal"
  },
  validation: {
    title: "无需校验",
    hint: "此控件没有可配置的校验。",
    icon: "shield-check"
  },
  linkage: {
    title: "不支持联动",
    hint: "此控件没有可配置的联动。",
    icon: "link-2"
  }
};

/**
 * Docked properties workbench on the right edge of the workspace — the mirror of
 * the tabbed left sidebar. Visible in edit mode and hidden during preview / JSON
 * mode; topped by a compact `控件` / `表单` switcher driven by selection:
 *
 * - selecting a node activates `控件` (and opens the overlay in narrow hosts)
 * - clearing the selection reverts to `表单` (no dead empty state)
 * - the user may peek at `表单` while a node is selected, and selecting any
 * node switches back to `控件`
 * - in narrow (`drawer`) layout, a right-edge trigger keeps `表单` reachable
 * even when nothing is selected
 *
 * Only the active tab's body is mounted, so form-level linkage walks never run
 * while editing a control, and node walks never run while editing form config.
 */
export function PropertiesPanel(): ReactElement {
  const isEditing = useFormEditorStore(s => s.viewMode === "edit");
  const hasSelection = useFormEditorStore(s => s.selectedId !== null);
  const propertiesTab = useFormEditorStore(s => s.propertiesTab);
  const drawerOpen = useFormEditorStore(s => s.propertiesDrawerOpen);
  const pendingLinkageFocus = useFormEditorStore(s => s.pendingLinkageFocus);
  const storeApi = useFormEditorStoreApi();
  const layout = useEditorLayout();

  // Retained here so switching `控件` → `表单` → `控件` keeps the field sub-tab.
  const [fieldTab, setFieldTab] = useState<PropertyTabId>("props");

  // Jumping to a node's linkage (from a diagnostic or the 字段联动 overview)
  // opens the field's "联动" tab immediately so the lazy LinkageRulesEntry
  // mounts on the first render and consumes `pendingLinkageFocus`.
  const effectiveFieldTab: PropertyTabId = pendingLinkageFocus !== null && pendingLinkageFocus.nodeId !== null
    ? "linkage"
    : fieldTab;

  useEffect(() => {
    if (pendingLinkageFocus !== null && pendingLinkageFocus.nodeId !== null) {
      setFieldTab("linkage");
    }
  }, [pendingLinkageFocus]);

  const isDrawer = layout === "drawer";
  const panelVisible = isEditing && (!isDrawer || drawerOpen);
  const showDrawerTrigger = isEditing && isDrawer && !drawerOpen;
  const resolvedPanelTab: PropertiesTabId = hasSelection ? propertiesTab : "form";

  return (
    <>
      <aside
        aria-label="属性"
        css={propertiesDockCss}
        data-layout={layout}
        data-tab={resolvedPanelTab}
        hidden={!panelVisible}
      >
        <div css={topBarCss}>
          <div aria-label="属性范围" css={scopeTrackCss} role="tablist">
            <button
              aria-selected={resolvedPanelTab === "control"}
              css={[scopeTabCss, resolvedPanelTab === "control" && scopeTabActiveCss]}
              disabled={!hasSelection}
              role="tab"
              title={hasSelection ? undefined : "请先在画布中选择控件"}
              type="button"
              onClick={() => storeApi.getState().setPropertiesTab("control")}
            >
              控件
            </button>

            <button
              aria-selected={resolvedPanelTab === "form"}
              css={[scopeTabCss, resolvedPanelTab === "form" && scopeTabActiveCss]}
              role="tab"
              type="button"
              onClick={() => storeApi.getState().setPropertiesTab("form")}
            >
              表单
            </button>
          </div>

          {isDrawer
            ? (
                <Button
                  aria-label="收起属性面板"
                  css={collapseButtonCss}
                  icon={<EditorIcon name="chevron-right" />}
                  size="small"
                  title="收起属性面板"
                  type="text"
                  onClick={() => storeApi.getState().setPropertiesDrawerOpen(false)}
                />
              )
            : null}
        </div>

        {panelVisible
          ? resolvedPanelTab === "control"
            ? <ControlProperties activeTab={effectiveFieldTab} onTabChange={setFieldTab} />
            : <FormPropertiesTab />
          : null}
      </aside>

      {showDrawerTrigger
        ? (
            <button
              aria-label={hasSelection ? "打开属性面板" : "打开表单属性"}
              css={propertiesDrawerTriggerCss}
              type="button"
              onClick={() => storeApi.getState().setPropertiesTab(hasSelection ? propertiesTab : "form")}
            >
              <EditorIcon name="settings-2" />
              <span>{hasSelection ? "属性" : "表单"}</span>
            </button>
          )
        : null}
    </>
  );
}

interface ControlPropertiesProps {
  activeTab: PropertyTabId;
  onTabChange: (tab: PropertyTabId) => void;
}

function ControlProperties({ activeTab, onTabChange }: ControlPropertiesProps): ReactElement {
  const selectedId = useFormEditorStore(s => s.selectedId);
  const schema = useFormEditorStore(s => s.schema);
  const layer = useCurrentLayer();
  const registry = useFieldRegistry();
  const storeApi = useFormEditorStoreApi();

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

  // Every selected field has a sizing control on the "布局" tab: a stack slot
  // (width / min / max / align) at the root or in a section / tab / stack-subform
  // body, a flex slot or grid span inside those containers, or a table-subform
  // column width. So the tab is always shown for a field, never a dead tab.
  const showLayout = field !== undefined;
  const tabs = useMemo(
    () => showLayout ? PROPERTY_TAB_ORDER : PROPERTY_TAB_ORDER.filter(tab => tab !== "layout"),
    [showLayout]
  );
  // Resolve away a stale selection so the body never renders a hidden tab.
  const resolvedTab = tabs.includes(activeTab) ? activeTab : "props";

  const deselect = (): void => {
    storeApi.getState().selectNode(null);
  };

  if (container) {
    return <ContainerProperties node={container} parent={located?.parent} onClose={deselect} />;
  }

  if (!field) {
    return <FormPropertiesTab />;
  }

  if (!definition) {
    return (
      <ScrollArea css={panelBodyCss} scrollbars="vertical">
        <PropertiesEmpty
          hint={`字段类型 "${field.type}" 未在当前 registry 中注册`}
          icon="circle-help"
          title="未知字段类型"
        />
      </ScrollArea>
    );
  }

  const handleChange = (entry: PropertyEntry, value: unknown): void => {
    // The data-binding key needs value-scope context (non-empty fallback +
    // per-scope uniqueness) that a field-level write lens cannot provide, so
    // route it to the dedicated store action.
    if (entry.id === "key" && typeof value === "string") {
      storeApi.getState().setFieldKey({ fieldId: field.id, key: value });
      return;
    }

    // Coalesce per entry, not per field: a run of keystrokes in one entry's
    // input folds into a single undo step, while moving on to another entry
    // (label → placeholder) starts a fresh one. Linkage edits are discrete
    // commits (confirmed rule dialogs, duplicates, deletes, default toggles),
    // so they omit `coalesceKey` and keep one undo step each.
    storeApi.getState().editField(
      { fieldId: field.id, updater: current => entry.write(current, value) },
      entry.type === "linkage-rules" ? undefined : { coalesceKey: `field:${field.id}:${entry.id}` }
    );
  };

  return (
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
        onChange={onTabChange}
      />

      <ScrollArea css={panelBodyCss} scrollbars="vertical">
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

  // The "布局" tab renders its own sizing control — stack width / min / max /
  // align, or a flex slot / grid span / table-subform column width depending on
  // the field's parent — rather than descriptor-driven property groups.
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
                  <div key={`${field.id}:${entry.id}`} css={unknownEntryCss} data-unknown-entry-type={entry.type}>
                    未注册的属性编辑器：
                    {entry.type}
                  </div>
                );
              }

              return (
                <Entry
                  // Keyed by FIELD identity too, not just the entry slot:
                  // switching the selection must remount every entry so a
                  // draft-buffered editor (KeyEntry's uncommitted key) can
                  // never leak the previous field's in-flight text onto — and
                  // later commit it over — the newly selected field.
                  key={`${field.id}:${entry.id}`}
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
