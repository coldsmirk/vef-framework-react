import type { FC } from "react";

import type { CcDefinition, CcKind, CcTiming } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Icon, Select } from "@vef-framework-react/components";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { useRowKeys } from "../../hooks/use-row-keys";
import { fullWidthStyle } from "../../styles";
import { isPrincipalKind } from "../../types";
import { FormField, PrincipalKindPicker, principalListItemHeaderStyle, principalListItemIndexStyle, principalListItemStyle } from "./shared";

const CC_KIND_OPTIONS: Array<{ label: string; value: CcKind }> = [
  { label: "指定用户", value: "user" },
  { label: "指定角色", value: "role" },
  { label: "指定部门", value: "department" },
  { label: "表单字段", value: "form_field" }
];

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

  const addItem = () => {
    onChange([...value, { kind: "user", ids: [] }]);
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
              options={CC_KIND_OPTIONS}
              value={item.kind}
              onChange={kind => {
                const next: Partial<CcDefinition> = { kind };

                if (isPrincipalKind(kind)) {
                  next.ids = [];
                  next.formField = undefined;
                } else {
                  next.ids = undefined;
                  next.formField = "";
                }

                updateItem(index, next);
              }}
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
