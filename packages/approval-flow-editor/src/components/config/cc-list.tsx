import type { FC } from "react";

import type { CcDefinition, CcTiming } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Icon, Select } from "@vef-framework-react/components";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { useRowKeys } from "../../hooks/use-row-keys";
import { useEditorPlugins } from "../../plugins";
import { fullWidthStyle } from "../../styles";
import { BUILTIN_CC_KINDS } from "../../types";
import { FormField, indexKinds, PrincipalKindPicker, principalListItemHeaderStyle, principalListItemIndexStyle, principalListItemStyle, principalRowResetFor } from "./shared";

const CC_TIMING_OPTIONS: Array<{ label: string; value: CcTiming }> = [
  { label: "始终抄送", value: "always" },
  { label: "仅同意时", value: "on_approve" },
  { label: "仅驳回时", value: "on_reject" }
];

const listStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingSm
});

interface CcListProps {
  value: CcDefinition[];
  onChange: (value: CcDefinition[]) => void;
  disabled?: boolean;
  showTiming?: boolean;
}

export const CcList: FC<CcListProps> = ({
  value,
  onChange,
  disabled,
  showTiming = false
}) => {
  const rowKeys = useRowKeys(value.length);
  const { ccKinds } = useEditorPlugins();
  // The application's catalog when the host wires one, the framework built-ins
  // otherwise — mirrors AssigneeList.
  const kinds = ccKinds ?? BUILTIN_CC_KINDS;
  const kindIndex = indexKinds(kinds);
  const kindOptions = kinds.map(descriptor => {
    return { label: descriptor.label, value: descriptor.kind };
  });

  const addItem = () => {
    const first = kinds[0];

    onChange([...value, { kind: first?.kind ?? "user", ...principalRowResetFor(first?.selection) }]);
  };

  const removeItem = (index: number) => {
    rowKeys.remove(index);
    onChange(value.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, partial: Partial<CcDefinition>) => {
    onChange(value.map((item, i) => i === index ? { ...item, ...partial } : item));
  };

  return (
    <div css={listStyle}>
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
                aria-label="删除抄送人"
                icon={<Trash2Icon size={14} />}
                size="small"
                type="text"
                onClick={() => removeItem(index)}
              />
            )}
          </div>

          <PrincipalKindPicker
            descriptor={kindIndex.get(item.kind)}
            disabled={disabled}
            item={item}
            onPatch={partial => updateItem(index, partial)}
          />

          {showTiming && (
            <FormField label="抄送时机">
              <Select
                css={fullWidthStyle}
                disabled={disabled}
                options={CC_TIMING_OPTIONS}
                value={item.timing ?? "always"}
                onChange={timingValue => updateItem(index, { timing: timingValue })}
              />
            </FormField>
          )}
        </div>
      ))}

      {!disabled && (
        <Button
          block
          icon={<Icon component={PlusIcon} />}
          type="dashed"
          onClick={addItem}
        >
          添加抄送人
        </Button>
      )}
    </div>
  );
};
