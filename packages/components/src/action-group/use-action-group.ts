import type { EmptyObject, If, IsNever } from "@vef-framework-react/shared";

import type { ActionGroupProps } from "./props";

import { useAuthorizedItems } from "@vef-framework-react/hooks";

import { useComputedActionButtons } from "./use-computed-action-buttons";

export function useActionGroup<TContext>(props: ActionGroupProps<TContext> & If<IsNever<TContext>, EmptyObject, { context: TContext }>) {
  const { size, buttons } = props;
  const context = Reflect.get(props, "context") as TContext;

  const authorizedButtons = useAuthorizedItems(buttons);
  const computedButtons = useComputedActionButtons(authorizedButtons, size, context);

  return {
    buttonNodes: computedButtons
  };
}
