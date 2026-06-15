import type { CollapseItem, TabItem } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type {
  AddControlChromeProps,
  ContainerChromeSet,
  RemoveControlChromeProps,
  SectionChromeProps,
  SubformChromeProps,
  SubformRowChromeProps,
  TabsChromeProps
} from "../../types";

import { Button, Card, Collapse, Tabs } from "@vef-framework-react/components";

import { EditorIcon } from "../../icons";
import {
  SECTION_PANEL_KEY,
  subformBodyCss,
  subformRemoveCss,
  subformRowBodyCss,
  subformRowCss
} from "./subform-shell";

function PcSection({
  children,
  defaultCollapsed,
  title,
  variant
}: SectionChromeProps): ReactElement {
  if (variant === "collapse") {
    const items: CollapseItem[] = [
      {
        children,
        key: SECTION_PANEL_KEY,
        label: title ?? ""
      }
    ];

    return <Collapse defaultActiveKey={defaultCollapsed ? [] : [SECTION_PANEL_KEY]} items={items} />;
  }

  return <Card title={title}>{children}</Card>;
}

function PcTabs({
  activeKey,
  items,
  onChange
}: TabsChromeProps): ReactElement {
  const tabItems: TabItem[] = items.map(item => {
    return {
      children: item.children,
      key: item.key,
      label: item.label
    };
  });

  return <Tabs activeKey={activeKey} items={tabItems} onChange={onChange} />;
}

function PcSubform({ children, title }: SubformChromeProps): ReactElement {
  return (
    <Card title={title}>
      <div css={subformBodyCss}>{children}</div>
    </Card>
  );
}

function PcSubformRow({ children, removeControl }: SubformRowChromeProps): ReactElement {
  return (
    <div css={subformRowCss}>
      <div css={subformRowBodyCss}>{children}</div>
      {removeControl}
    </div>
  );
}

function PcAddButton({ label, onClick }: AddControlChromeProps): ReactElement {
  return (
    <Button icon={<EditorIcon name="plus" />} type="dashed" onClick={onClick}>
      {label}
    </Button>
  );
}

function PcRemoveButton({ onClick }: RemoveControlChromeProps): ReactElement {
  return (
    <Button
      danger
      aria-label="删除此行"
      css={subformRemoveCss}
      icon={<EditorIcon name="trash-2" />}
      type="text"
      onClick={onClick}
    />
  );
}

/**
 * The PC container chrome — antd `Card` / `Collapse` / `Tabs` / `Button` shells,
 * lifted verbatim from the former inline renderers so device-aware routing is a
 * no-op visual change on PC.
 */
export const pcContainerChrome: ContainerChromeSet = {
  AddButton: PcAddButton,
  RemoveButton: PcRemoveButton,
  Section: PcSection,
  Subform: PcSubform,
  SubformRow: PcSubformRow,
  Tabs: PcTabs
};
