import type { EmptyObject, If, IsNever } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { ActionGroupProps } from "./props";

import { isFunction } from "@vef-framework-react/shared";

import { Group } from "../group";
import { useActionGroup } from "./use-action-group";

export function ActionGroup<TContext = never>(
  props: ActionGroupProps<TContext> & If<IsNever<TContext>, EmptyObject, { context: TContext }>
): ReactNode {
  const { renderWrapper } = props;
  const { buttonNodes } = useActionGroup(props);

  if (isFunction(renderWrapper)) {
    return renderWrapper(buttonNodes);
  }

  if (buttonNodes.length > 0) {
    return (
      <Group>
        {buttonNodes}
      </Group>
    );
  }

  return null;
}

export { type ActionGroupProps } from "./props";
