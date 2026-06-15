import type { PermissionCheckMode } from "@vef-framework-react/core";
import type { AnyObject, Awaitable, EmptyObject, If, IsNever, LiteralUnion, Simplify } from "@vef-framework-react/shared";
import type { ReactNode, Ref } from "react";

import type { ButtonColor, ButtonVariant } from "../../button";
import type { colors, fullSizes, presetColors, semanticColors, semanticScenes, sizes } from "../constants";

export type PresetColor = (typeof presetColors)[number];
export type SemanticScene = (typeof semanticScenes)[number];
export type SemanticColor = (typeof semanticColors)[number];
export type Color = Simplify<PresetColor | SemanticColor>;
export type Colors = typeof colors;

export type Size = (typeof sizes)[number];
export type FullSize = (typeof fullSizes)[number];
export type Orientation = "horizontal" | "vertical";
export type ActionConfirmMode = "popover" | "dialog";
export type Length = string | number;

export type ActionButtonMaybeComputed<TContext, TValue>
  = If<IsNever<TContext>, TValue, TValue | ((context: TContext) => TValue)>;

export type SizeableLength<TSize extends FullSize | Size> = LiteralUnion<TSize, Length>;

export type { GetProp, GetProps, GetRef } from "antd";

export type PropsWithRef<TRef, TProps extends AnyObject = EmptyObject> = TProps & {
  ref?: Ref<TRef>;
};

export type RangeValue<TValue> = [
    start: TValue,
    end: TValue
];

export interface Position {
  x: number;
  y: number;
}

export interface OrderSpec {
  column: string;
  direction: "asc" | "desc";
}

export interface ActionButtonConfig<TContext = never> {
  key: string;
  label: string;
  disabled?: ActionButtonMaybeComputed<TContext, boolean>;
  hidden?: ActionButtonMaybeComputed<TContext, boolean>;
  color?: ButtonColor;
  variant?: ButtonVariant;
  icon?: ReactNode;
  requiredPermissions?: string[];
  checkMode?: PermissionCheckMode;
  confirmable?: ActionButtonMaybeComputed<TContext, boolean>;
  confirmMode?: ActionButtonMaybeComputed<TContext, ActionConfirmMode>;
  confirmTitle?: ActionButtonMaybeComputed<TContext, ReactNode>;
  confirmDescription?: ActionButtonMaybeComputed<TContext, ReactNode>;
  onClick: (context: If<IsNever<TContext>, void, TContext>) => Awaitable<void>;
}
