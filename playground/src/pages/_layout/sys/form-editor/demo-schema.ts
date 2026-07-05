import type { FormSchema } from "@vef-framework-react/form-editor";

/**
 * Default schema the form-editor playground route boots with, so the designer
 * always opens onto a small form that exercises validation and a few linkages
 * (condition → alert on the age field, condition → show/require on the bio
 * field, `$user`-rooted condition → show on the finance-note field, driven by
 * the route's `evaluationContext`). Handy for manually testing the editor
 * without rebuilding a form each time.
 */
export const DEMO_SCHEMA: FormSchema = {
  id: "Form_gdq7dcisy7ff6evn",
  version: 2,
  presentations: {
    pc: {
      children: [
        {
          type: "textfield",
          label: "姓名",
          id: "Field_o0q2lcjobcbcfhit",
          key: "name",
          placeholder: "请输入姓名",
          validate: {
            required: true
          }
        },
        {
          type: "number",
          label: "年龄",
          id: "Field_hxscz8kqbmtcgbmf",
          key: "age",
          placeholder: "请输入年龄",
          min: 0,
          max: 100,
          step: 1,
          validate: {
            required: true
          },
          linkage: {
            rules: [
              {
                id: "Rule_d92dx7p6bpl025mb",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "group",
                    id: "Condition_u2bhi3rpyftjr27v",
                    logic: "all",
                    children: [
                      {
                        kind: "leaf",
                        id: "Condition_cm95b8sm7l2zdio0",
                        sourceKey: "age",
                        operator: "gte",
                        value: "18"
                      }
                    ]
                  }
                },
                actions: [
                  {
                    id: "Action_e06a9ap0t4iw0zwc",
                    type: "alert",
                    level: "info",
                    message: {
                      kind: "literal",
                      value: "年龄已达标"
                    }
                  }
                ]
              },
              {
                id: "Rule_qwqb1vvjjrr9q93j",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "group",
                    id: "Condition_wk0e1vkq9paqxxqe",
                    logic: "all",
                    children: [
                      {
                        kind: "leaf",
                        id: "Condition_rvy7p778pudluqzw",
                        sourceKey: "age",
                        operator: "lt",
                        value: "18"
                      }
                    ]
                  }
                },
                actions: [
                  {
                    id: "Action_wza14plusrgiegpx",
                    type: "alert",
                    level: "warning",
                    message: {
                      kind: "expression",
                      source: "'您的年龄太小了，还未成年。当前年龄: ' + field.age"
                    }
                  }
                ]
              }
            ]
          }
        },
        {
          type: "textarea",
          label: "个人简介",
          id: "Field_mmm6rechc18b1a6e",
          key: "desc",
          placeholder: "请输入个人简介",
          linkage: {
            defaults: {
              hidden: true
            },
            rules: [
              {
                id: "Rule_wt9119i3mmtqgyio",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "group",
                    id: "Condition_ymlkog94v41r4v1d",
                    logic: "all",
                    children: [
                      {
                        kind: "leaf",
                        id: "Condition_nuba127aa2sc28sv",
                        sourceKey: "age",
                        operator: "gte",
                        value: "18"
                      }
                    ]
                  }
                },
                actions: [
                  {
                    id: "Action_wlgygcw41ags6wb3",
                    type: "show"
                  },
                  {
                    id: "Action_se3ky84w0y050vp5",
                    type: "require"
                  }
                ]
              }
            ]
          },
          validate: {
            required: false
          }
        },
        {
          type: "textfield",
          label: "财务备注",
          id: "Field_finance_note_demo",
          key: "financeNote",
          placeholder: "仅财务部发起人可见",
          helperText: "由 $user.departmentName 全局上下文条件控制显示",
          linkage: {
            defaults: {
              hidden: true
            },
            rules: [
              {
                id: "Rule_finance_note_demo",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "group",
                    id: "Condition_finance_group_demo",
                    logic: "all",
                    children: [
                      {
                        kind: "leaf",
                        id: "Condition_finance_leaf_demo",
                        sourceKey: "$user.departmentName",
                        operator: "eq",
                        value: "财务部"
                      }
                    ]
                  }
                },
                actions: [
                  {
                    id: "Action_finance_show_demo",
                    type: "show"
                  }
                ]
              }
            ]
          }
        },
        {
          type: "flex",
          direction: "row",
          children: [
            {
              type: "button",
              label: "提交",
              action: "submit",
              id: "Field_eo786ms6vdupj7w8"
            },
            {
              type: "button",
              label: "重置",
              action: "reset",
              id: "Field_ri53so17i67gpp1c"
            }
          ],
          id: "Field_blkuy0tgvlb6r4fi"
        }
      ]
    }
  }
};
