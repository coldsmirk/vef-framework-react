import type { SerializedStyles } from "@emotion/react";
import type { ReactElement, ReactNode } from "react";

import type {
  AddControlChromeProps,
  ContainerChromeSet,
  RemoveControlChromeProps,
  SectionChromeProps,
  SubformChromeProps,
  SubformRowChromeProps,
  TabsChromeProps
} from "../../types";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import Button from "antd-mobile/es/components/button";
import Collapse from "antd-mobile/es/components/collapse";
import Tabs from "antd-mobile/es/components/tabs";

import { EditorIcon } from "../../icons";
import {
  SECTION_PANEL_KEY,
  subformBodyCss,
  subformRemoveCss,
  subformRowBodyCss,
  subformRowCss
} from "./subform-shell";

// antd-mobile ships no antd-style `Card`, so card-like containers (the `card`
// Section variant and the Subform group) are composed from `globalCssVars`
// tokens to read as a titled, bordered surface — matching the PC `Card` shell
// while staying inside the `--vef-*` theme that adapts to light / dark.
const cardCss = css({
  borderRadius: globalCssVars.borderRadius,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  background: globalCssVars.colorBgContainer,
  overflow: "hidden"
});

const cardTitleCss = css({
  padding: "10px 12px",
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  color: globalCssVars.colorTextHeading,
  fontWeight: globalCssVars.fontWeightStrong
});

const cardBodyCss = css({
  padding: 12
});

// antd-mobile's Button wraps its children in a bare span with no gap, so an icon
// sits flush against the label. An inline-flex row restores the icon-to-text gap
// the PC chrome gets for free from antd's `icon` prop.
const addButtonContentCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 6
});

/**
 * The shared antd-mobile card surface (antd-mobile has no `Card`): a bordered
 * container with an optional title bar and a padded body. `bodyExtra` lets the
 * subform stack its rows inside the same shell.
 */
function MobileCard({
  bodyExtra,
  children,
  title
}: {
  bodyExtra?: SerializedStyles;
  children: ReactNode;
  title?: ReactNode;
}): ReactElement {
  return (
    <div css={cardCss}>
      {title === undefined ? null : <div css={cardTitleCss}>{title}</div>}
      <div css={bodyExtra ? [cardBodyCss, bodyExtra] : cardBodyCss}>{children}</div>
    </div>
  );
}

function MobileSection({
  children,
  defaultCollapsed,
  title,
  variant
}: SectionChromeProps): ReactElement {
  if (variant === "collapse") {
    return (
      <Collapse defaultActiveKey={defaultCollapsed ? [] : [SECTION_PANEL_KEY]}>
        <Collapse.Panel key={SECTION_PANEL_KEY} title={title ?? ""}>
          {children}
        </Collapse.Panel>
      </Collapse>
    );
  }

  return <MobileCard title={title}>{children}</MobileCard>;
}

function MobileTabs({
  activeKey,
  items,
  onChange
}: TabsChromeProps): ReactElement {
  return (
    <Tabs activeKey={activeKey} onChange={onChange}>
      {items.map(item => (
        <Tabs.Tab key={item.key} title={item.label}>
          {item.children}
        </Tabs.Tab>
      ))}
    </Tabs>
  );
}

function MobileSubform({ children, title }: SubformChromeProps): ReactElement {
  return <MobileCard bodyExtra={subformBodyCss} title={title}>{children}</MobileCard>;
}

function MobileSubformRow({ children, removeControl }: SubformRowChromeProps): ReactElement {
  return (
    <div css={subformRowCss}>
      <div css={subformRowBodyCss}>{children}</div>
      {removeControl}
    </div>
  );
}

function MobileAddButton({ label, onClick }: AddControlChromeProps): ReactElement {
  return (
    <Button block fill="outline" onClick={onClick}>
      <span css={addButtonContentCss}>
        <EditorIcon name="plus" />
        {label}
      </span>
    </Button>
  );
}

function MobileRemoveButton({ onClick }: RemoveControlChromeProps): ReactElement {
  return (
    <Button
      aria-label="删除此行"
      color="danger"
      css={subformRemoveCss}
      fill="none"
      onClick={onClick}
    >
      <EditorIcon name="trash-2" />
    </Button>
  );
}

/**
 * The mobile container chrome — antd-mobile `Collapse` / `Tabs` / `Button`
 * primitives plus token-styled card surfaces (antd-mobile has no `Card`),
 * mirroring {@link pcContainerChrome}. Every member is purely presentational:
 * recursion, value binding, and array handlers stay in the renderer, which
 * passes already-built bodies in as `children`.
 */
export const mobileContainerChrome: ContainerChromeSet = {
  AddButton: MobileAddButton,
  RemoveButton: MobileRemoveButton,
  Section: MobileSection,
  Subform: MobileSubform,
  SubformRow: MobileSubformRow,
  Tabs: MobileTabs
};
