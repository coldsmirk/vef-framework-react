import type { ReactNode } from "react";

import { Alert, useFormContext } from "@vef-framework-react/components";

import classes from "../styles/index.module.scss";

interface ErrorMessageProps {
  configKey: string;
}

interface FieldState {
  isValid?: boolean;
  errors?: Array<{ message: string }>;
}

export function ErrorMessage({ configKey }: ErrorMessageProps): ReactNode {
  const { Subscribe } = useFormContext();
  const escapedKey = configKey.replaceAll(".", ":");

  return (
    <Subscribe
      selector={state => {
        const fieldMeta = state.fieldMeta[escapedKey];

        if (!fieldMeta) {
          return {} as FieldState;
        }

        return {
          isValid: fieldMeta.isValid,
          errors: fieldMeta.errors
        } as FieldState;
      }}
    >
      {({ isValid, errors }) => {
        const firstError = errors?.[0];

        if (isValid || !firstError) {
          return null;
        }

        return (
          <Alert
            className={classes.errorMessage}
            title={firstError.message}
            type="error"
          />
        );
      }}
    </Subscribe>
  );
}
