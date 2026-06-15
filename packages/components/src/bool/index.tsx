import type { BoolProps } from "./props";

import { isUndefined } from "@vef-framework-react/shared";
import { memo } from "react";

import { Checkbox } from "../checkbox";
import { Group } from "../group";
import { Radio } from "../radio";
import { Switch } from "../switch";

export const Bool = memo((props: BoolProps) => {
  const {
    value,
    defaultValue,
    onChange,
    variant = "switch",
    trueLabel,
    falseLabel,
    children,
    disabled,
    size,
    className,
    style
  } = props;

  if (variant === "radio" || variant === "radio-button") {
    return (
      <Radio.Group
        buttonStyle="solid"
        className={className}
        defaultValue={defaultValue}
        disabled={disabled}
        size={size}
        style={style}
        value={value}
        onChange={e => {
          onChange?.(e.target.value);
        }}
      >
        {
          variant === "radio"
            ? (
                <>
                  <Radio value>{trueLabel || "是"}</Radio>
                  <Radio value={false}>{falseLabel || "否"}</Radio>
                </>
              )
            : (
                <>
                  <Radio.Button value>{trueLabel || "是"}</Radio.Button>
                  <Radio.Button value={false}>{falseLabel || "否"}</Radio.Button>
                </>
              )
        }
      </Radio.Group>
    );
  }

  if (variant === "checkbox") {
    return (
      <Checkbox
        checked={value}
        className={className}
        defaultChecked={defaultValue}
        disabled={disabled}
        style={style}
        onChange={e => {
          onChange?.(e.target.checked);
        }}
      >
        {children}
      </Checkbox>
    );
  }

  // variant === "switch"
  const switchNode = (
    <Switch
      checked={value}
      checkedChildren={trueLabel}
      defaultChecked={defaultValue}
      disabled={disabled}
      size={size === "small" ? "small" : isUndefined(size) ? void 0 : "medium"}
      unCheckedChildren={falseLabel}
      onChange={checked => {
        onChange?.(checked);
      }}
    />
  );

  if (!children) {
    return switchNode;
  }

  return (
    <Group
      className={className}
      gap="small"
      style={style}
    >
      {switchNode}
      <span>{children}</span>
    </Group>
  );
});

Bool.displayName = "Bool";

export type { BoolProps, BoolVariant } from "./props";
