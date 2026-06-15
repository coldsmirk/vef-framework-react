import type { DataScopeTarget } from "~apis";

import { Button, Icon, Popover, Tabs } from "@vef-framework-react/components";
import { clsx } from "@vef-framework-react/core";
import { isDeepEqual } from "@vef-framework-react/shared";
import { CheckIcon } from "lucide-react";
import { memo, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { findDepartmentTreeOptions, findOrganizationTreeOptions } from "~apis";

import classes from "../styles/index.module.scss";
import { TransferSelector } from "./transfer-selector";

interface ScopeSelectorProps {
  value: DataScopeTarget[];
  onChange: (targets: DataScopeTarget[]) => void;
}

const OrganizationSelector = memo(({ value, onChange }: ScopeSelectorProps) => (
  <TransferSelector
    queryFn={findOrganizationTreeOptions}
    title={["机构列表", "已选机构"]}
    type="O"
    value={value}
    onChange={onChange}
  />
), (prev, next) => isDeepEqual(prev.value, next.value) && prev.onChange === next.onChange);
OrganizationSelector.displayName = "OrganizationSelector";

const DepartmentSelector = memo(({ value, onChange }: ScopeSelectorProps) => (
  <TransferSelector
    showOrgSelect
    queryFn={findDepartmentTreeOptions}
    title={["部门列表", "已选部门"]}
    type="D"
    value={value}
    onChange={onChange}
  />
), (prev, next) => isDeepEqual(prev.value, next.value) && prev.onChange === next.onChange);
DepartmentSelector.displayName = "DepartmentSelector";

export interface DataScopeSelectorProps {
  show: boolean;
  value: DataScopeTarget[];
  onChange: (value: DataScopeTarget[]) => void;
}

export function DataScopeSelector({
  show,
  value,
  onChange
}: DataScopeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [dataScopeTargets, setDataScopeTargets] = useState<DataScopeTarget[]>([]);

  const syncDataScopeTargets = useEffectEvent((newValue: DataScopeTarget[]) => {
    if (!isDeepEqual(newValue, dataScopeTargets)) {
      setDataScopeTargets(newValue);
    }
  });

  useEffect(() => {
    syncDataScopeTargets(value);
  }, [value]);

  const updateTargets = useCallback((type: "O" | "D", newTargets: DataScopeTarget[]) => {
    setDataScopeTargets(targets => [
      ...targets.filter(target => target.type !== type),
      ...newTargets
    ]);
  }, []);

  const handleComplete = useCallback(() => {
    onChange(dataScopeTargets);
    setOpen(false);
  }, [dataScopeTargets, onChange]);

  const organizationTargets = useMemo(
    () => dataScopeTargets.filter(target => target.type === "O"),
    [dataScopeTargets]
  );

  const departmentTargets = useMemo(
    () => dataScopeTargets.filter(target => target.type === "D"),
    [dataScopeTargets]
  );

  const handleOrganizationChange = useCallback(
    (targets: DataScopeTarget[]) => updateTargets("O", targets),
    [updateTargets]
  );

  const handleDepartmentChange = useCallback(
    (targets: DataScopeTarget[]) => updateTargets("D", targets),
    [updateTargets]
  );

  const tabItems = useMemo(() => [
    {
      key: "organization",
      label: "选择机构",
      children: <OrganizationSelector value={organizationTargets} onChange={handleOrganizationChange} />
    },
    {
      key: "department",
      label: "选择部门",
      children: <DepartmentSelector value={departmentTargets} onChange={handleDepartmentChange} />
    }
  ], [organizationTargets, departmentTargets, handleOrganizationChange, handleDepartmentChange]);

  const tabBarExtraContent = useMemo(() => (
    <Button
      color="primary"
      icon={<Icon component={CheckIcon} />}
      variant="filled"
      onClick={handleComplete}
    >
      完成
    </Button>
  ), [handleComplete]);

  return (
    <Popover
      classNames={{ title: classes.popoverTitle }}
      open={open}
      placement="left"
      title="选择数据范围"
      trigger="click"
      content={(
        <Tabs
          className={classes.tabs}
          items={tabItems}
          tabBarExtraContent={tabBarExtraContent}
        />
      )}
      onOpenChange={setOpen}
    >
      <Button
        className={clsx(classes.customDataScopeButton, { hidden: !show })}
        type="link"
      >
        选择
      </Button>
    </Popover>
  );
}
