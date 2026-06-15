import type { If, IsNever } from "@vef-framework-react/shared";
import type { SizeType } from "antd/es/config-provider/SizeContext";
import type { ReactNode } from "react";

import type { ActionButtonConfig, ActionConfirmMode } from "../_base";

import { isFunction } from "@vef-framework-react/shared";
import { useMemo } from "react";

import { ActionButton } from "../action-button";

/**
 * Resolves a value that can be either a static value or a function that computes the value from context.
 */
function resolveValue<TContext, TValue>(
  value: TValue | ((ctx: TContext) => TValue) | undefined,
  context: TContext,
  defaultValue: TValue
): TValue {
  if (isFunction(value)) {
    return value(context);
  }

  return (value as TValue) ?? defaultValue;
}

/**
 * The hook to compute the action buttons.
 *
 * @param buttons - The action button configs.
 * @param size - The button size.
 * @param context - The context.
 * @returns The computed action buttons.
 */
export function useComputedActionButtons<TContext>(
  buttons: Array<ActionButtonConfig<TContext>>,
  size: SizeType,
  context: TContext
): ReactNode[] {
  return useMemo(() => buttons
    .map(button => {
      const {
        key,
        label,
        icon,
        color,
        variant,
        onClick
      } = button;

      const hidden = resolveValue(button.hidden, context, false);

      if (hidden) {
        return null;
      }

      const disabled = resolveValue(button.disabled, context, false);
      const confirmable = resolveValue(button.confirmable, context, false);
      const confirmMode = resolveValue<TContext, ActionConfirmMode>(button.confirmMode, context, "popover");
      const confirmTitle = resolveValue<TContext, ReactNode>(button.confirmTitle, context, "确认提示");
      const confirmDescription = resolveValue<TContext, ReactNode>(
        button.confirmDescription,
        context,
        `确定要${label}吗？`
      );

      return (
        <ActionButton
          key={key}
          color={color}
          confirmable={confirmable}
          confirmDescription={confirmDescription}
          confirmMode={confirmMode}
          confirmTitle={confirmTitle}
          disabled={disabled}
          icon={icon}
          size={size}
          variant={variant}
          onClick={() => onClick(context as If<IsNever<TContext>, void, TContext>)}
        >
          {label}
        </ActionButton>
      );
    })
    .filter(Boolean), [buttons, size, context]);
}
