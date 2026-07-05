import type { DynamicIconName } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { FormConfigTabId, FormSchemaPatch } from "../../store/form-store";
import type { FormSchema, PresentationLayer } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, ScrollArea } from "@vef-framework-react/components";
import { AnimatePresence, motion } from "@vef-framework-react/core";

import { assertNever } from "../../engine/assert-never";
import { EditorIcon } from "../../icons";
import { selectFieldCount, selectLinkageRuleCount, useCurrentLayer, useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { FormDataSourcesPanel } from "../properties/form-data-sources-panel";
import { FormLinkagePanel } from "../properties/form-linkage-panel";
import { FormVariablesPanel } from "../properties/form-variables-panel";
import { panelTransition } from "../styles";
import { FormBasicsTab } from "./form-basics-tab";
import { LinkageOverview } from "./linkage-overview";
import { OutlineTab } from "./outline-tab";

const DRAWER_Z = 6;

const shellCss = css({
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: "44%",
  minHeight: 260,
  maxHeight: 480,
  zIndex: DRAWER_Z,
  display: "flex",
  flexDirection: "column",
  background: globalCssVars.colorBgContainer,
  borderTop: `1px solid ${globalCssVars.colorBorderSecondary}`,
  boxShadow: globalCssVars.boxShadowDrawerUp,
  overflow: "hidden"
});

const headerCss = css({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  flexShrink: 0
});

const tabRowCss = css({
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 4,
  minWidth: 0,
  overflowX: "auto"
});

const tabCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 7,
  border: "1px solid transparent",
  background: "transparent",
  color: globalCssVars.colorTextSecondary,
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "&:hover": {
    background: globalCssVars.colorFillTertiary,
    color: globalCssVars.colorText
  }
});

const tabSelectedCss = css({
  background: globalCssVars.colorPrimaryBg,
  borderColor: globalCssVars.colorPrimaryBorder,
  color: globalCssVars.colorPrimary,

  "&:hover": {
    background: globalCssVars.colorPrimaryBg,
    color: globalCssVars.colorPrimary
  }
});

const badgeCss = css({
  minWidth: 18,
  padding: "0 5px",
  borderRadius: 9,
  background: globalCssVars.colorFillSecondary,
  color: globalCssVars.colorTextSecondary,
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
  textAlign: "center"
});

const bodyCss = css({
  flex: 1,
  minHeight: 0
});

const reusedBodyCss = css({
  padding: "18px 22px 24px"
});

const sectionTitleCss = css({
  marginBottom: 10,
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 600,
  color: globalCssVars.colorTextSecondary
});

const eventsSectionCss = css({
  marginTop: 22
});

interface DrawerTab {
  key: FormConfigTabId;
  label: string;
  icon: DynamicIconName;
}

const DRAWER_TABS: DrawerTab[] = [
  {
    key: "outline",
    label: "大纲",
    icon: "list-tree"
  },
  {
    key: "form",
    label: "表单",
    icon: "settings-2"
  },
  {
    key: "variables",
    label: "变量",
    icon: "braces"
  },
  {
    key: "dataSources",
    label: "数据源",
    icon: "database"
  },
  {
    key: "linkage",
    label: "联动",
    icon: "link-2"
  }
];

const slideVariants = {
  hidden: { y: "100%" },
  visible: { y: 0 }
};

/**
 * Bottom form-config drawer: a docked sheet (no modal backdrop, so the right
 * control-property panel stays interactive alongside it) carrying the
 * form-level configuration across five tabs. The outline tab selects canvas
 * controls; the rest reuse the form-scope panels, writing through `patchSchema`.
 */
export function FormConfigDrawer(): ReactElement {
  const open = useFormEditorStore(s => s.formConfigOpen);

  // Only `open` is read here, so a collapsed drawer never re-renders (nor walks
  // the field tree for tab counts) on unrelated schema edits. All of that lives
  // in DrawerSheet, which is mounted only while the sheet is open.
  return (
    <AnimatePresence>
      {open
        ? (
            <motion.section
              animate="visible"
              css={shellCss}
              exit="hidden"
              initial="hidden"
              transition={panelTransition}
              variants={slideVariants}
            >
              <DrawerSheet />
            </motion.section>
          )
        : null}
    </AnimatePresence>
  );
}

function DrawerSheet(): ReactElement {
  const tab = useFormEditorStore(s => s.formConfigTab);
  const schema = useFormEditorStore(s => s.schema);
  const layer = useCurrentLayer();
  const storeApi = useFormEditorStoreApi();
  // Shares the toolbar/footer's WeakMap-memoized walk instead of re-counting
  // the tree on every drawer render.
  const fieldsCount = useFormEditorStore(selectFieldCount);
  // Same aggregate the footer chip shows (field rules + form events): the tab
  // opens onto the overview of exactly that set, so the two numbers must agree.
  const linkageCount = useFormEditorStore(selectLinkageRuleCount);

  const counts: Record<FormConfigTabId, number> = {
    outline: fieldsCount,
    form: 0,
    variables: schema.variables?.length ?? 0,
    dataSources: schema.dataSources?.length ?? 0,
    linkage: linkageCount
  };

  const patch = (next: FormSchemaPatch): void => {
    storeApi.getState().patchSchema(next);
  };

  return (
    <>
      <div css={headerCss}>
        {/* Real tab semantics (mirroring the properties panel's tab strip) so
            assistive tech and accessible queries see one tab list, not five
            loose buttons. */}
        <div aria-label="表单配置" css={tabRowCss} role="tablist">
          {DRAWER_TABS.map(item => (
            <button
              key={item.key}
              aria-selected={tab === item.key}
              css={[tabCss, tab === item.key && tabSelectedCss]}
              role="tab"
              type="button"
              onClick={() => storeApi.getState().setFormConfigTab(item.key)}
            >
              <EditorIcon name={item.icon} />
              <span>{item.label}</span>
              {counts[item.key] > 0 ? <span css={badgeCss}>{counts[item.key]}</span> : null}
            </button>
          ))}
        </div>

        <Button
          aria-label="收起表单配置"
          icon={<EditorIcon name="chevron-down" />}
          type="text"
          onClick={() => storeApi.getState().setFormConfigOpen(false)}
        />
      </div>

      <ScrollArea css={bodyCss}>
        <DrawerBody layer={layer} patch={patch} schema={schema} tab={tab} />
      </ScrollArea>
    </>
  );
}

function DrawerBody({
  layer,
  patch,
  schema,
  tab
}: {
  layer: PresentationLayer;
  patch: (next: FormSchemaPatch) => void;
  schema: FormSchema;
  tab: FormConfigTabId;
}): ReactElement {
  // The store's WeakMap-cached count (one walk per layer identity) — the
  // basics tab renders it without re-walking the tree per keystroke.
  const fieldCount = useFormEditorStore(selectFieldCount);

  // Exhaustive over the closed FormConfigTabId union: a new tab id fails the
  // typecheck at `assertNever` rather than silently falling through to linkage.
  // outline / form render bare; the form-scope panels share the `reusedBodyCss`
  // padding wrapper, applied per branch (it cannot be hoisted above them).
  switch (tab) {
    case "outline": {
      return <OutlineTab />;
    }

    case "form": {
      return <FormBasicsTab fieldCount={fieldCount} layer={layer} schema={schema} onPatch={patch} />;
    }

    case "variables": {
      return (
        <div css={reusedBodyCss}>
          <FormVariablesPanel
            variables={schema.variables ?? []}
            onChange={variables => patch({ variables: variables.length > 0 ? variables : undefined })}
          />
        </div>
      );
    }

    case "dataSources": {
      return (
        <div css={reusedBodyCss}>
          <FormDataSourcesPanel
            dataSources={schema.dataSources ?? []}
            onChange={dataSources => patch({ dataSources: dataSources.length > 0 ? dataSources : undefined })}
          />
        </div>
      );
    }

    case "linkage": {
      // Two zones behind one count: the read-only index of field-level rules
      // (authored on each control's 联动 tab) and the editable form-level
      // event rules. Without the index, the footer's "N 联动" chip lands on a
      // panel that may legitimately say "no rules" — a dead-end scent.
      return (
        <div css={reusedBodyCss}>
          <section>
            <div css={sectionTitleCss}>字段联动</div>
            <LinkageOverview />
          </section>

          <section css={eventsSectionCss}>
            <div css={sectionTitleCss}>表单事件</div>
            <FormLinkagePanel schema={schema} onChange={linkage => patch({ linkage })} />
          </section>
        </div>
      );
    }

    default: {
      return assertNever(tab);
    }
  }
}
