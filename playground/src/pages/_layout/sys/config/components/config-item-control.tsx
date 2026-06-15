import type { MaybeNull } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import { useFormContext } from "@vef-framework-react/components";
import { z } from "@vef-framework-react/shared";

import classes from "../styles/index.module.scss";

type ValueType = "B" | "N" | "S" | "T";

interface SelectOption {
  label: string;
  value: string;
}

interface ConfigItemMeta {
  options?: SelectOption[];
}

interface ConfigItemControlProps {
  configKey: string;
  valueType: string;
  isRequired: boolean;
  meta?: MaybeNull<ConfigItemMeta>;
}

export function ConfigItemControl({
  configKey,
  valueType,
  isRequired,
  meta
}: ConfigItemControlProps): ReactNode {
  const { AppField } = useFormContext();
  const escapedKey = configKey.replaceAll(".", ":");

  switch (valueType as ValueType) {
    case "T": {
      return (
        <AppField
          name={escapedKey}
          validators={{
            onBlur: isRequired ? z.string("必须") : undefined
          }}
        >
          {fieldApi => (
            <fieldApi.Input
              noWrapper
              className={classes.configItemControlInput}
            />
          )}
        </AppField>
      );
    }

    case "N": {
      return (
        <AppField
          name={escapedKey}
          validators={{
            onBlur: isRequired ? z.number("必须") : undefined
          }}
        >
          {fieldApi => (
            <fieldApi.InputNumber
              noWrapper
              className={classes.configItemControlInput}
            />
          )}
        </AppField>
      );
    }

    case "B": {
      return (
        <AppField
          name={escapedKey}
          validators={{
            onBlur: isRequired ? z.boolean("必须") : undefined
          }}
        >
          {fieldApi => (
            <fieldApi.Bool
              noWrapper
              variant="switch"
            />
          )}
        </AppField>
      );
    }

    case "S": {
      return (
        <AppField
          name={escapedKey}
          validators={{
            onBlur: isRequired ? z.string("必须") : undefined
          }}
        >
          {fieldApi => (
            <fieldApi.Select
              noWrapper
              options={meta?.options ?? []}
              required={isRequired}
            />
          )}
        </AppField>
      );
    }

    default: {
      return null;
    }
  }
}
