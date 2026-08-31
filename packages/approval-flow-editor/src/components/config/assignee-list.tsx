import type { FC } from "react";

import type { AssigneeDefinition } from "../../types";

import { Button, Icon, Select, Stack } from "@vef-framework-react/components";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { useRowKeys } from "../../hooks/use-row-keys";
import { useEditorPlugins } from "../../plugins";
import { fullWidthStyle } from "../../styles";
import { BUILTIN_ASSIGNEE_KINDS } from "../../types";
import { indexKinds, PrincipalKindPicker, principalListItemHeaderStyle, principalListItemIndexStyle, principalListItemStyle, principalRowResetFor } from "./shared";

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
  const { assigneeKinds } = useEditorPlugins();
  // The application's catalog when the host wires one, the framework built-ins
  // otherwise — an editor with no metadata integration still offers the kinds
  // every deployment has.
  const kinds = assigneeKinds ?? BUILTIN_ASSIGNEE_KINDS;
  const kindIndex = indexKinds(kinds);
  const kindOptions = kinds.map(descriptor => {
    return { label: descriptor.label, value: descriptor.kind };
  });

  const emitAssignees = (next: AssigneeDefinition[]) => {
    onChange(next.map((a, i) => {
      return { ...a, sortOrder: i + 1 };
    }));
  };

  const addAssignee = () => {
    const first = kinds[0];

    emitAssignees([
      ...value,
      {
        kind: first?.kind ?? "user",
        ...principalRowResetFor(first?.selection),
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
              options={kindOptions}
              value={item.kind}
              onChange={kind => updateItem(index, { kind, ...principalRowResetFor(kindIndex.get(kind)?.selection) })}
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
            descriptor={kindIndex.get(item.kind)}
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
