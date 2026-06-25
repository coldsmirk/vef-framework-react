import type { ChangeEvent } from "react";

import { Group, Input, TreeSelect, useDataOptionsTreeSelect } from "@vef-framework-react/components";
import { useDebouncedValue } from "@vef-framework-react/hooks";
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { findDepartmentTreeOptions, findOrganizationTreeOptions } from "~apis";

import classes from "../styles/index.module.scss";

interface UserSearchValue {
  keyword?: string;
  deptId?: string;
}

interface UserSearchProps {
  value: UserSearchValue;
  onChange: (value: UserSearchValue) => void;
}

export function UserSearch({ value, onChange }: UserSearchProps) {
  const [keyword, setKeyword] = useState<string>();
  const [orgId, setOrgId] = useState<string>();
  const [debouncedKeyword] = useDebouncedValue(keyword, 500);

  const syncKeyword = useEffectEvent((keyword?: string) => {
    onChange({ ...value, keyword });
  });

  useEffect(() => {
    syncKeyword(debouncedKeyword);
  }, [debouncedKeyword]);

  const organizationTreeSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findOrganizationTreeOptions.key],
      queryFn: findOrganizationTreeOptions
    }
  });

  const departmentTreeSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findDepartmentTreeOptions.key, { orgId }],
      queryFn: findDepartmentTreeOptions
    }
  });

  const handleKeywordChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setKeyword(event.currentTarget.value);
  }, []);

  const handleOrgChange = useCallback((newOrgId: string) => {
    setOrgId(newOrgId);
    onChange({ ...value, deptId: undefined });
  }, [value, onChange]);

  const handleDeptChange = useCallback((deptId: string) => {
    onChange({ ...value, deptId });
  }, [value, onChange]);

  return (
    <Group>
      <Input
        allowClear
        className={classes.searchField}
        placeholder="姓名/工号"
        value={keyword}
        onChange={handleKeywordChange}
      />

      <TreeSelect
        {...organizationTreeSelectProps}
        allowClear
        className={classes.searchField}
        placeholder="机构"
        value={orgId}
        onChange={handleOrgChange}
      />

      <TreeSelect
        {...departmentTreeSelectProps}
        allowClear
        className={classes.searchField}
        placeholder="部门"
        value={value.deptId}
        onChange={handleDeptChange}
      />
    </Group>
  );
}
