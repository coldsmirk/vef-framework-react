import type { AnyObject, MaybeUndefined } from "@vef-framework-react/shared";
import type { ConfigOptions as MessageConfig } from "antd/es/message/interface";
import type { NotificationConfig } from "antd/es/notification/interface";

import type { FormLayout } from "../form";
import type { FormModalProps } from "../form-modal";
import type { ImageProps } from "../image";
import type { InputProps, TextAreaProps } from "../input";
import type { PaginationProps } from "../pagination";
import type { ProTableProps } from "../pro-table";
import type { SelectProps } from "../select";

import { pick } from "@vef-framework-react/shared";
import { createContext, use } from "react";

import { filterProps } from "../_base";

/**
 * The props type each defaultable entry picks from, keyed by the exported
 * component name.
 */
interface DefaultablePropSources {
  Form: FormLayout;
  FormModal: FormModalProps<object>;
  Image: ImageProps;
  Input: InputProps;
  Message: MessageConfig;
  Notification: NotificationConfig;
  Pagination: PaginationProps;
  ProTable: ProTableProps<AnyObject, AnyObject>;
  Select: SelectProps;
  TextArea: TextAreaProps;
}

/**
 * The entire surface an application can default. A prop qualifies only when
 * its right value depends on the business rather than the design system, it
 * stays correct wherever the framework itself renders the component, it does
 * not restyle the component, and it does not bypass a framework pipeline.
 * Everything else is a framework convention with no application-wide entry
 * point; a single instance may still pass it explicitly.
 *
 * `allowClear` is open on text inputs only: clearing one yields the empty string
 * a user reaches by deleting the text anyway, whereas clearing a select or a date
 * picker yields `undefined`, which the framework's own required selects and
 * pickers (designer panels, flow node configuration) cannot represent.
 *
 * `ComponentDefaults` is derived from this table and `resolveComponentDefaults`
 * picks by it at runtime, so the type and the enforcement cannot drift.
 */
const defaultablePropKeys = {
  Form: ["labelAlign", "labelWidth"],
  FormModal: ["draggable"],
  Image: ["fallback"],
  Input: ["allowClear", "autoComplete"],
  Message: ["duration", "maxCount"],
  Notification: ["duration", "maxCount"],
  Pagination: ["showSizeChanger"],
  ProTable: ["rowKey", "showSequenceColumn", "striped"],
  Select: ["showSearch"],
  TextArea: ["allowClear", "autoComplete"]
} as const satisfies { [TName in keyof DefaultablePropSources]: ReadonlyArray<keyof DefaultablePropSources[TName]> };

export type DefaultableComponent = keyof DefaultablePropSources;

/**
 * Application-wide default props for framework components, keyed by the
 * exported component name.
 */
export type ComponentDefaults = {
  [TName in DefaultableComponent]?: Pick<
    DefaultablePropSources[TName],
    Extract<(typeof defaultablePropKeys)[TName][number], keyof DefaultablePropSources[TName]>
  >;
};

/**
 * Narrow application-supplied defaults to the whitelist, dropping unset values
 * and entries left empty, so a consumer can treat a present entry as meaningful.
 */
export function resolveComponentDefaults(components: ComponentDefaults = {}): ComponentDefaults {
  const resolved: Record<string, unknown> = {};

  for (const [name, keys] of Object.entries(defaultablePropKeys)) {
    const entry: MaybeUndefined<Record<string, unknown>> = components[name as DefaultableComponent];

    if (!entry) {
      continue;
    }

    const picked = filterProps(pick(entry, keys));

    if (Object.keys(picked).length > 0) {
      resolved[name] = picked;
    }
  }

  return resolved as ComponentDefaults;
}

const ComponentDefaultsContext = createContext<ComponentDefaults>({});
ComponentDefaultsContext.displayName = "ComponentDefaultsContext";

export const ComponentDefaultsProvider = ComponentDefaultsContext.Provider;

/**
 * Read the application default for a framework component, already narrowed to
 * its whitelist. `undefined` when the application sets nothing for it.
 */
export function useComponentDefaults<TName extends DefaultableComponent>(name: TName): ComponentDefaults[TName] {
  return use(ComponentDefaultsContext)[name];
}

/**
 * Resolve a component's props against the application defaults: a prop passed
 * explicitly (anything but `undefined`) wins, then the application default,
 * leaving the component's own destructuring defaults as the final fallback.
 * Returns `props` itself when the application sets nothing for `name`.
 */
export function useDefaultProps<TProps extends object>(name: DefaultableComponent, props: TProps): TProps {
  const defaults = useComponentDefaults(name);

  if (!defaults) {
    return props;
  }

  return {
    ...defaults,
    ...filterProps(props as Record<string, unknown>)
  } as TProps;
}
