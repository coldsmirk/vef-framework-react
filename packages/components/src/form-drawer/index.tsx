import type { Awaitable } from "@vef-framework-react/shared";
import type { FC, ReactNode } from "react";

import type { GetProp } from "../_base";
import type { DrawerProps } from "../drawer";
import type { FormApi } from "../form";
import type { FormDrawerProps } from "./props";

import { css } from "@emotion/react";
import { useMutation } from "@vef-framework-react/core";
import { isFunction } from "@vef-framework-react/shared";
import { memo, useCallback, useMemo } from "react";

import { Center } from "../center";
import { Drawer } from "../drawer";
import { Empty } from "../empty";
import { DefaultResetButton, DefaultSubmitButton, FormActions, useForm } from "../form";

const formStyle = css({
  height: "100%"
});

const emptyContent = (
  <Center>
    <Empty description="请提供表单内容" />
  </Center>
);

function renderFormContent<TValues extends object>(
  children: FormDrawerProps<TValues>["children"],
  formApi: FormApi<TValues>
): ReactNode {
  if (isFunction(children)) {
    return children(formApi);
  }

  return children || emptyContent;
}

export const FormDrawer = memo(<TValues extends object, TData = unknown>({
  open = false,
  title,
  width,
  placement = "right",
  resizable,
  defaultValues,
  disabled = false,
  formComponent,
  renderActions,
  submitButtonProps,
  resetButtonProps,
  mutationFn,
  mutationMeta,
  children,
  beforeSubmit,
  afterSubmit,
  onClose,
  onSubmit,
  onReset
}: FormDrawerProps<TValues, TData>) => {
  const formApi = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      let formValues = value;

      if (isFunction(beforeSubmit)) {
        formValues = await beforeSubmit(formValues);
      }

      if (isFunction(onSubmit)) {
        await onSubmit(formValues);
      }

      if (mutationFn) {
        await mutateAsync(formValues);
      } else if (!onSubmit) {
        handleClose();
      }
    }
  });

  const {
    Form,
    AppForm,
    reset
  } = formApi;

  const handleClose = useCallback(() => {
    reset();
    onClose?.();
  }, [onClose, reset]);

  const { isPending, mutateAsync } = useMutation({
    mutationKey: [mutationFn?.key],
    mutationFn,
    onSuccess: async ({ data }, formValues) => {
      if (isFunction(afterSubmit)) {
        await afterSubmit(formValues, data);
      }

      handleClose();
    },
    meta: mutationMeta
  });

  const handleReset = useCallback(() => {
    onReset?.(defaultValues);
  }, [defaultValues, onReset]);

  const handleCancel = useCallback(() => {
    if (isPending) {
      return;
    }

    handleClose();
  }, [handleClose, isPending]);

  const drawerStyles = useMemo<GetProp<DrawerProps, "styles">>(
    () => { return { wrapper: { width } }; },
    [width]
  );

  const proxiedFormApi = useMemo(
    () => new Proxy(formApi, {
      get(target, prop, receiver) {
        if (prop === "reset") {
          const originalReset = Reflect.get(target, prop, receiver);

          return () => {
            originalReset();
            handleReset();
          };
        }

        return Reflect.get(target, prop, receiver);
      }
    }),
    [formApi, handleReset]
  );

  const footer = renderActions
    ? (() => {
        const actions = renderActions(proxiedFormApi, {
          submitButton: <DefaultSubmitButton submitButtonProps={submitButtonProps} />,
          resetButton: <DefaultResetButton resetButtonProps={resetButtonProps} onReset={handleReset} />
        });

        return actions
          ? (
              <AppForm>
                {actions}
              </AppForm>
            )
          : null;
      })()
    : (
        <AppForm>
          <FormActions
            resetButtonProps={resetButtonProps}
            submitButtonProps={submitButtonProps}
            onReset={handleReset}
          />
        </AppForm>
      );

  return (
    <Drawer
      destroyOnHidden
      footer={footer}
      keyboard={false}
      open={open}
      placement={placement}
      resizable={resizable}
      styles={drawerStyles}
      title={title}
      onClose={handleCancel}
    >
      <AppForm>
        <Form component={formComponent} css={formStyle} disabled={disabled || isPending}>
          {renderFormContent(children, formApi)}
        </Form>
      </AppForm>
    </Drawer>
  );
}) as (<TValues extends object, TData = unknown>(props: FormDrawerProps<TValues, TData>) => Awaitable<ReactNode>) & Pick<FC, "displayName">;
FormDrawer.displayName = "FormDrawer";

export type { FormDrawerProps } from "./props";
