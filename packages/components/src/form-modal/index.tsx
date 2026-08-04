import type { Awaitable } from "@vef-framework-react/shared";
import type { FC, ReactNode } from "react";

import type { FormApi } from "../form";
import type { FormModalProps } from "./props";

import { useMutation } from "@vef-framework-react/core";
import { isFunction } from "@vef-framework-react/shared";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import { Center } from "../center";
import { Empty } from "../empty";
import { DefaultResetButton, DefaultSubmitButton, FormActions, useForm } from "../form";
import { Modal } from "../modal";

const emptyContent = (
  <Center>
    <Empty description="请提供表单内容" />
  </Center>
);

function renderFormContent<TValues extends object>(
  children: FormModalProps<TValues>["children"],
  formApi: FormApi<TValues>
): ReactNode {
  if (isFunction(children)) {
    return children(formApi);
  }

  return children || emptyContent;
}

export const FormModal = memo(<TValues extends object, TData = unknown>({
  open = false,
  title,
  width,
  draggable = true,
  submitButtonProps,
  resetButtonProps,
  defaultValues,
  disabled = false,
  formComponent,
  formLayout,
  renderActions,
  mutationFn,
  mutationMeta,
  children,
  beforeSubmit,
  afterSubmit,
  onClose,
  onSubmit,
  onReset
}: FormModalProps<TValues, TData>) => {
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
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- mutateAsync is defined below but only invoked from this deferred submit callback.
        await mutateAsync(formValues);
      } else if (!onSubmit) {
        onClose?.();
      }
    }
  });

  const {
    Form,
    AppForm,
    reset
  } = formApi;

  const { isPending, mutateAsync } = useMutation({
    mutationKey: [mutationFn?.key],
    mutationFn,
    onSuccess: async ({ data }, formValues) => {
      if (isFunction(afterSubmit)) {
        await afterSubmit(formValues, data);
      }

      onClose?.();
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

    onClose?.();
  }, [isPending, onClose]);

  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      reset();
    }

    wasOpenRef.current = open;
  }, [open, reset]);

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
    <Modal
      centered
      destroyOnHidden
      draggable={draggable}
      footer={footer}
      keyboard={false}
      open={open}
      title={title}
      width={width}
      onCancel={handleCancel}
    >
      <AppForm>
        <Form {...formLayout} component={formComponent} disabled={disabled || isPending}>
          {renderFormContent(children, formApi)}
        </Form>
      </AppForm>
    </Modal>
  );
}) as (<TValues extends object, TData = unknown>(props: FormModalProps<TValues, TData>) => Awaitable<ReactNode>) & Pick<FC, "displayName">;
FormModal.displayName = "FormModal";

export type { FormModalProps } from "./props";
