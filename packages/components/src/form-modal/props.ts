import type { ApiResult, MutationFunction, MutationMeta } from "@vef-framework-react/core";
import type { Awaitable } from "@vef-framework-react/shared";
import type { ElementType, ReactNode } from "react";

import type { FormActionsProps, FormApi, FormLayout } from "../form";
import type { ModalProps } from "../modal";

/**
 * Props for the FormModal component
 *
 * @template TValues - The type of the form values
 * @template TData - The type of the mutation response data
 */
export interface FormModalProps<TValues extends object, TData = unknown> extends Pick<ModalProps, "title" | "width"> {
  /**
   * Whether the form modal is visible
   *
   * @default false
   */
  open?: boolean;
  /**
   * Whether the modal can be dragged by its header
   *
   * @default true
   */
  draggable?: boolean;
  /**
   * Default form values
   */
  defaultValues?: TValues;
  /**
   * Whether to disable the form
   *
   * @default false
   */
  disabled?: boolean;
  /**
   * The element type for the inner form wrapper.
   *
   * @default "form"
   */
  formComponent?: ElementType;
  /**
   * Layout of the form items inside the modal (label position, alignment and
   * width). Defaults to the horizontal, right-aligned label layout.
   */
  formLayout?: FormLayout;
  /**
   * Custom render function for footer actions.
   * Receives the form API and default action buttons (submit and reset) as arguments.
   * Return null to hide the footer entirely.
   * If not provided, will render default submit and reset buttons.
   *
   * @example
   * // Add a custom button alongside defaults
   * renderActions={(formApi, { submitButton, resetButton }) => (
   *   <>
   *     <Button onClick={handleDraft}>Save Draft</Button>
   *     {resetButton}
   *     {submitButton}
   *   </>
   * )}
   */
  renderActions?: (formApi: FormApi<TValues>, defaults: { submitButton: ReactNode; resetButton: ReactNode }) => ReactNode;
  /**
   * Submit button props (only used when renderActions is not provided)
   */
  submitButtonProps?: FormActionsProps["submitButtonProps"];
  /**
   * Reset button props, or false to hide the reset button (only used when renderActions is not provided)
   */
  resetButtonProps?: FormActionsProps["resetButtonProps"];
  /**
   * Mutation function to execute on submit
   */
  mutationFn?: MutationFunction<ApiResult<TData>, TValues>;
  /**
   * Mutation metadata
   */
  mutationMeta?: MutationMeta;
  /**
   * Form content, can be a ReactNode or a function that receives form API
   */
  children?: ReactNode | ((formApi: FormApi<TValues>) => ReactNode);
  /**
   * Callback before form submission
   */
  beforeSubmit?: (values: TValues) => Awaitable<TValues>;
  /**
   * Callback after successful submission
   */
  afterSubmit?: (values: TValues, data: TData) => Awaitable<void>;
  /**
   * Callback on form submit
   */
  onSubmit?: (values: TValues) => Awaitable<void>;
  /**
   * Callback on form reset
   */
  onReset?: (defaultValues?: TValues) => void;
  /**
   * Callback when modal is closed
   */
  onClose?: () => void;
}
