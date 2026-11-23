import type { ApprovalFormField } from "@vef-framework-react/approval-form-bridge";

import { Card, Table, Text } from "@vef-framework-react/components";

const FIELD_LABELS: Record<ApprovalFormField["kind"], string> = {
  input: "单行文本",
  textarea: "多行文本",
  number: "数字",
  date: "日期",
  datetime: "日期时间",
  daterange: "日期区间",
  select: "选项",
  upload: "附件",
  table: "明细表"
};

export function FieldCatalog({ fields, title }: { fields: ApprovalFormField[]; title: string }) {
  return (
    <Card title={title}>
      <Table<ApprovalFormField>
        dataSource={fields}
        expandable={{ childrenColumnName: "columns" }}
        locale={{ emptyText: "暂无字段" }}
        pagination={false}
        rowKey="key"
        size="small"
        columns={[
          { title: "名称", dataIndex: "label" },
          {
            title: "字段键",
            dataIndex: "key",
            render: (key: string) => <Text code>{key}</Text>
          },
          {
            title: "类型",
            dataIndex: "kind",
            render: (kind: ApprovalFormField["kind"]) => FIELD_LABELS[kind]
          }
        ]}
      />
    </Card>
  );
}
