import type { EditableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import {
  createEditableColumn,
  EditableTable,
  Page,
  Stack,
  Tag,
  Text,
  Title
} from "@vef-framework-react/components";
import { useState } from "react";

interface Member {
  id: string;
  name: string;
  age: number;
  dept: string;
}

const deptOptions = [
  { label: "研发部", value: "rd" },
  { label: "市场部", value: "mkt" },
  { label: "财务部", value: "fin" }
];

const initialMembers: Member[] = [
  {
    id: "1",
    name: "张三",
    age: 32,
    dept: "rd"
  },
  {
    id: "2",
    name: "李四",
    age: 28,
    dept: "mkt"
  }
];

const columns: Array<EditableColumn<Member>> = [
  createEditableColumn<Member>("name", {
    title: "姓名",
    width: 180,
    validators: { onChange: ({ value }) => value ? undefined : "姓名必填" },
    renderEditor: field => <field.Input noWrapper placeholder="请输入姓名" />
  }),
  createEditableColumn<Member>("age", {
    title: "年龄",
    width: 160,
    renderEditor: field => <field.InputNumber noWrapper max={65} min={18} style={{ width: "100%" }} />
  }),
  createEditableColumn<Member>("dept", {
    title: "部门",
    width: 220,
    renderView: value => {
      const option = deptOptions.find(item => item.value === value);
      return option ? <Tag>{option.label}</Tag> : "-";
    },
    renderEditor: field => <field.Select noWrapper options={deptOptions} placeholder="请选择部门" style={{ width: "100%" }} />
  })
];

const jsonStyle = {
  margin: 0,
  padding: "12px 16px",
  borderRadius: 8,
  background: "var(--vef-color-fill-quaternary)",
  fontSize: 12,
  overflow: "auto"
} as const;

export const Route = createFileRoute("/_layout/sys/editable-table-demo")({
  component: EditableTableDemoPage
});

function EditableTableDemoPage(): ReactNode {
  const [members, setMembers] = useState<Member[]>(initialMembers);

  return (
    <Page margin scrollable>
      <Stack gap="medium">
        <Stack gap="small">
          <Title level={4}>可编辑表格 EditableTable</Title>

          <Text type="secondary">
            受控的行内可编辑表格：一次只编辑一行，编辑 / 新增 / 删除都是对 value 数组的操作并通过 onChange 吐出，不涉及请求接口。
            每列用 renderView（只读态）/ renderEditor（编辑态）双槽，validators 负责整行校验。
          </Text>
        </Stack>

        <EditableTable<Member>
          canDelete
          creatable
          columns={columns}
          rowKey="id"
          value={members}
          createRecord={() => {
            return {
              name: "",
              age: 25,
              dept: "rd"
            };
          }}
          onChange={setMembers}
        />

        <Stack gap="small">
          <Text strong>当前 value（观察 onChange 输出）：</Text>
          <pre style={jsonStyle}>{JSON.stringify(members, null, 2)}</pre>
        </Stack>
      </Stack>
    </Page>
  );
}
