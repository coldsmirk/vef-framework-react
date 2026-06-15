import type { ComponentProps, FC } from "react";

import type { ButtonField, FieldComponentProps } from "../../types";

import Button from "antd-mobile/es/components/button";

type ButtonProps = ComponentProps<typeof Button>;

/**
 * The visual `buttonType` (antd `type`) maps to the antd-mobile `color` / `fill`
 * pair, since antd-mobile has no single `type` token. `primary` is a solid filled
 * action; `default` / `dashed` are neutral outlines (mobile has no dashed border);
 * `text` / `link` drop the fill, differing only in color. `danger` overrides the
 * color afterwards, mirroring the PC button's `danger` flag.
 */
const typePresentation: Record<NonNullable<ButtonField["buttonType"]>, {
  color: NonNullable<ButtonProps["color"]>;
  fill: NonNullable<ButtonProps["fill"]>;
}> = {
  primary: { color: "primary", fill: "solid" },
  default: { color: "default", fill: "outline" },
  dashed: { color: "default", fill: "outline" },
  text: { color: "default", fill: "none" },
  link: { color: "primary", fill: "none" }
};

/**
 * Mobile read-only renderer for buttons. Mirrors the PC button contract: the
 * native `type` attribute is driven by `field.action` (defaulting to `"submit"`,
 * matching the field factory), the visual treatment by `field.buttonType`
 * (defaulting to `"primary"`), and the label falls back to `"按钮"`.
 */
export const MobileButton: FC<FieldComponentProps<ButtonField, undefined>> = ({
  disabled,
  domId,
  field
}) => {
  const base = typePresentation[field.buttonType ?? "primary"];
  const color = field.danger ? "danger" : base.color;
  const { fill } = base;

  return (
    <Button
      block={field.block ?? true}
      color={color}
      disabled={disabled}
      fill={fill}
      id={domId}
      shape={field.shape === "round" ? "rounded" : "default"}
      size={field.size}
      type={field.action ?? "submit"}
    >
      {field.label ?? "按钮"}
    </Button>
  );
};
