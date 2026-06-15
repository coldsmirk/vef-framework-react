import type { TreeSelectProps } from "@vef-framework-react/components";
import type { DataOption, DataOptionWithPinyin } from "@vef-framework-react/core";
import type { ReactNode } from "react";
import type { StaffSearch } from "~apis";

import { useDataOptionsTreeSelect, useFormContext } from "@vef-framework-react/components";
import { findDepartmentTreeOptions, findOrganizationTreeOptions } from "~apis";

interface DepartmentSelectWrapperProps {
  orgId?: string;
  children: (props: TreeSelectProps<string, DataOptionWithPinyin<DataOption>>) => ReactNode;
}

function DepartmentSelectWrapper({ orgId, children }: DepartmentSelectWrapperProps): ReactNode {
  const departmentTreeSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findDepartmentTreeOptions.key, { orgId }],
      queryFn: findDepartmentTreeOptions
    }
  });

  return children(departmentTreeSelectProps);
}

export function BasicSearch(): ReactNode {
  const form = useFormContext<StaffSearch>();
  const { AppField, Subscribe } = form;

  const organizationTreeSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findOrganizationTreeOptions.key],
      queryFn: findOrganizationTreeOptions
    }
  });

  return (
    <>
      <AppField
        listeners={{ onChange: () => form.setFieldValue("deptId", undefined) }}
        name="orgId"
      >
        {field => (
          <field.TreeSelect
            {...organizationTreeSelectProps}
            allowClear
            noWrapper
            placeholder="机构"
          />
        )}
      </AppField>

      <AppField name="deptId">
        {field => (
          <Subscribe selector={state => state.values.orgId}>
            {orgId => (
              <DepartmentSelectWrapper orgId={orgId}>
                {props => <field.TreeSelect {...props} allowClear noWrapper placeholder="部门" />}
              </DepartmentSelectWrapper>
            )}
          </Subscribe>
        )}
      </AppField>

      <AppField name="keyword">
        {field => <field.Input noWrapper placeholder="关键词" />}
      </AppField>
    </>
  );
}
