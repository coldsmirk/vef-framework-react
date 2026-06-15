import type { FC } from "react";

import type { AssigneeDefinition, AssigneeKind } from "../../types";

import { Button, Icon, Select, Stack } from "@vef-framework-react/components";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { useRowKeys } from "../../hooks/use-row-keys";
import { fullWidthStyle } from "../../styles";
import { isPrincipalKind } from "../../types";
import { PrincipalKindPicker, principalListItemHeaderStyle, principalListItemIndexStyle, principalListItemStyle } from "./shared";

const ASSIGNEE_KIND_OPTIONS: Array<{ label: string; value: AssigneeKind }> = [
  { label: "指定用户", value: "user" },
  { label: "指定角色", value: "role" },
  { label: "指定部门", value: "department" },
  { label: "发起人本人", value: "self" },
  { label: "直属上级", value: "superior" },
  { label: "部门负责人", value: "department_leader" },
  { label: "表单字段", value: "form_field" }
];

interface AssigneeListProps {
  value: AssigneeDefinition[];
  onChange: (value: AssigneeDefinition[]) => void;
  disabled?: boolean;
}

/**
 * Controlled assignee-row editor — same value/onChange contract as CcList, so
 * both principal lists compose identically and stay store-agnostic. Emits rows
 * with sortOrder renumbered to their position.
 */
export const AssigneeList: FC<AssigneeListProps> = ({
  value,
  onChange,
  disabled
}) => {
  const rowKeys = useRowKeys(value.length);

  const emitAssignees = (next: AssigneeDefinition[]) => {
    onChange(next.map((a, i) => {
      return { ...a, sortOrder: i + 1 };
    }));
  };

  const addAssignee = () => {
    emitAssignees([
      ...value,
      {
        kind: "user",
        ids: [],
        sortOrder: value.length + 1
      }
    ]);
  };

  const removeAssignee = (index: number) => {
    rowKeys.remove(index);
    emitAssignees(value.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, partial: Partial<AssigneeDefinition>) => {
    emitAssignees(value.map((a, i) => i === index ? { ...a, ...partial } : a));
  };

  return (
    <Stack>
      {value.map((item, index) => (
        <div key={rowKeys.keys[index]} css={principalListItemStyle}>
          <div css={principalListItemHeaderStyle}>
            <span css={principalListItemIndexStyle}>{index + 1}</span>

            <Select
              css={fullWidthStyle}
              disabled={disabled}
              options={ASSIGNEE_KIND_OPTIONS}
              value={item.kind}
              onChange={kind => {
                const next: Partial<AssigneeDefinition> = { kind };

                if (isPrincipalKind(kind)) {
                  next.ids = [];
                  next.formField = undefined;
                } else if (kind === "form_field") {
                  next.ids = undefined;
                  next.formField = "";
                } else {
                  next.ids = undefined;
                  next.formField = undefined;
                }

                updateItem(index, next);
              }}
            />

            {!disabled && (
              <Button
                danger
                aria-label="删除处理人"
                icon={<Trash2Icon size={14} />}
                size="small"
                type="text"
                onClick={() => removeAssignee(index)}
              />
            )}
          </div>

          <PrincipalKindPicker
            disabled={disabled}
            item={item}
            onPatch={partial => updateItem(index, partial)}
          />
        </div>
      ))}

      {!disabled && (
        <Button
          block
          icon={<Icon component={PlusIcon} />}
          type="dashed"
          onClick={addAssignee}
        >
          添加处理人
        </Button>
      )}
    </Stack>
  );
};
