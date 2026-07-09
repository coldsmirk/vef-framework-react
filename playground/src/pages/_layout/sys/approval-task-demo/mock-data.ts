import type { FieldPermission, FormSchema } from "@vef-framework-react/form-editor";

/**
 * Self-contained fixture for the `approval-task-demo` playground route. Shapes
 * a small expense-reimbursement form the way `my.get_instance_detail` would:
 * a form-editor `FormSchema`, applicant-filled `formData`, and a viewer-scoped
 * `fieldPermissions` clamp. Field keys are chosen so every permission axis
 * (`editable` / `required` / `visible` / `hidden`) is exercised exactly once,
 * plus a `visible` subform table — mirrors the column shape of
 * `packages/approval-form-bridge/src/__fixtures__/formeditor-parity/subform_table.schema.json`.
 */

export const MOCK_TASK_ID = "task-demo-0001";

export const MOCK_FORM_SCHEMA: FormSchema = {
  id: "Form_approval_task_demo",
  version: 2,
  presentations: {
    pc: {
      children: [
        {
          id: "Field_applicant",
          type: "textfield",
          key: "applicant",
          label: "申请人",
          placeholder: "请输入申请人姓名"
        },
        {
          id: "Field_reason",
          type: "textfield",
          key: "reason",
          label: "报销事由",
          placeholder: "请输入报销事由",
          validate: { maxLength: 200 }
        },
        {
          id: "Field_approved_amount",
          type: "number",
          key: "approvedAmount",
          label: "核定金额",
          // No static `validate.required` here on purpose — the "必填" behavior
          // for this field comes entirely from the `"required"` fieldPermissions
          // clamp below, which is exactly the case the demo exercises.
          placeholder: "审批人核定后填写",
          min: 0,
          precision: 2,
          prefix: "¥"
        },
        {
          id: "Field_cost_center",
          type: "select",
          key: "costCenter",
          label: "费用归属部门",
          placeholder: "请选择费用归属部门",
          dataSource: {
            kind: "static",
            options: [
              { label: "研发部", value: "dev" },
              { label: "市场部", value: "marketing" },
              { label: "财务部", value: "finance" }
            ]
          }
        },
        {
          id: "Subform_items",
          type: "subform",
          variant: "table",
          key: "items",
          label: "费用明细",
          minRows: 1,
          template: [
            {
              id: "Field_item_desc",
              type: "textfield",
              key: "desc",
              label: "费用项目"
            },
            {
              id: "Field_item_amount",
              type: "number",
              key: "amount",
              label: "金额",
              precision: 2
            },
            {
              id: "Field_item_category",
              type: "select",
              key: "category",
              label: "类别",
              dataSource: {
                kind: "static",
                options: [
                  { label: "交通", value: "transport" },
                  { label: "餐饮", value: "meal" },
                  { label: "住宿", value: "lodging" }
                ]
              }
            }
          ]
        }
      ]
    }
  }
};

/**
 * Applicant-filled `formData`, already shaped like the detail API's
 * viewer-scoped `instance.formData` — two fields are deliberately absent:
 *
 * - `approvedAmount`: the approver's own field, left empty so the
 * `"required"` clamp below has a genuinely empty value to fail on.
 * - `costCenter`: clamped `"hidden"` for every viewer in this demo, and the
 * real backend never sends a viewer a value it has already redacted.
 */
export const MOCK_FORM_DATA: Record<string, unknown> = {
  applicant: "王芳",
  reason: "上海出差交通及住宿费用报销",
  items: [
    {
      desc: "高铁票",
      amount: 680,
      category: "transport"
    },
    {
      desc: "酒店住宿",
      amount: 1200,
      category: "lodging"
    }
  ]
};

export interface ViewerPreset {
  id: string;
  label: string;
  /**
   * One-line explanation of what this preset demonstrates.
   */
  caption: string;
  fieldPermissions: Record<string, FieldPermission>;
  /**
   * Empty means the viewer has nothing to execute — see `route.tsx`.
   */
  availableActions: Array<"approve" | "reject">;
}

export const VIEWER_PRESETS: ViewerPreset[] = [
  {
    id: "approver",
    label: "审批人视角",
    caption: "申请人只读、报销事由可编辑、核定金额必填（不填直接点通过即可看到必填校验）、费用归属对审批人不可见、费用明细只读。",
    fieldPermissions: {
      applicant: "visible",
      reason: "editable",
      approvedAmount: "required",
      costCenter: "hidden",
      items: "visible"
    },
    availableActions: ["approve", "reject"]
  },
  {
    id: "cc",
    label: "抄送人视角",
    caption: "除费用归属仍不可见外，其余字段均为只读展示；抄送人没有可执行的操作，操作栏隐藏，表单整体禁用。",
    fieldPermissions: {
      applicant: "visible",
      reason: "visible",
      approvedAmount: "visible",
      costCenter: "hidden",
      items: "visible"
    },
    availableActions: []
  }
];
