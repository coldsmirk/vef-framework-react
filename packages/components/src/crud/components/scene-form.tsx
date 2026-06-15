import type { AnyObject } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { BaseCrudProps } from "../props";
import type { CrudState } from "../store";
import type { CrudFormScene } from "../types";

import { useShallow } from "@vef-framework-react/core";
import { useBreakpoints } from "@vef-framework-react/hooks";
import { isFunction, isPlainObject } from "@vef-framework-react/shared";
import { memo } from "react";

import { breakpoints, resolveBreakpointValue } from "../../_base";
import { FormDrawer } from "../../form-drawer";
import { FormModal } from "../../form-modal";
import { useCrudStore } from "../store";

interface SceneFormProps<TSceneFormValues extends AnyObject>
  extends Pick<
    BaseCrudProps<AnyObject, AnyObject, TSceneFormValues, AnyObject>,
    "renderForm" | "formComponent" | "formMutationFns" | "formActionsRenderers" | "beforeFormSubmit" | "afterFormSubmit" | "mutationMeta"
  > {}

export const SceneForm = memo(<TSceneFormValues extends AnyObject>({
  renderForm,
  formComponent = "div",
  formMutationFns,
  formActionsRenderers,
  beforeFormSubmit,
  afterFormSubmit,
  mutationMeta
}: SceneFormProps<TSceneFormValues>) => {
  const {
    formVisible,
    closeForm,
    formScene,
    defaultFormValues,
    formTitle,
    formWidth,
    formMode,
    drawerConfig,
    refetchQuery
  } = useCrudStore(
    useShallow((state: CrudState<AnyObject, AnyObject, TSceneFormValues>) => {
      return {
        formVisible: state.formVisible,
        closeForm: state.closeForm,
        formScene: state.formScene,
        defaultFormValues: state.defaultFormValues,
        formTitle: state.formTitle,
        formWidth: state.formWidth,
        formMode: state.formMode,
        drawerConfig: state.drawerConfig,
        refetchQuery: state.refetchQuery
      };
    })
  );

  const { current: currentBreakpoint } = useBreakpoints(breakpoints, {
    initialBreakpoint: "xxs"
  });

  const mutationFn = formMutationFns?.[formScene];
  const resolvedWidth = isPlainObject(formWidth)
    ? resolveBreakpointValue(formWidth, currentBreakpoint!)
    : formWidth;

  const formProps = {
    open: formVisible,
    title: formTitle,
    defaultValues: defaultFormValues,
    mutationFn,
    mutationMeta: isFunction(mutationMeta) && mutationFn
      ? mutationMeta(mutationFn.key)
      : undefined,
    renderActions: formActionsRenderers?.[formScene],
    beforeSubmit: isFunction(beforeFormSubmit)
      ? (formValues: TSceneFormValues[CrudFormScene<TSceneFormValues>]) => beforeFormSubmit(formScene, formValues)
      : undefined,
    afterSubmit: async (formValues: TSceneFormValues[CrudFormScene<TSceneFormValues>], data: unknown) => {
      await afterFormSubmit?.(formScene, formValues, data);
      refetchQuery();
    },
    onClose: closeForm
  };

  const formChildren = isFunction(renderForm) ? renderForm(formScene) : undefined;

  if (formMode === "drawer") {
    return (
      <FormDrawer
        {...formProps}
        formComponent={formComponent}
        placement={drawerConfig?.placement}
        width={resolvedWidth}
      >
        {formChildren}
      </FormDrawer>
    );
  }

  return (
    <FormModal {...formProps} formComponent={formComponent} width={resolvedWidth}>
      {formChildren}
    </FormModal>
  );
}) as <TSceneFormValues extends AnyObject>(props: SceneFormProps<TSceneFormValues>) => ReactNode;
