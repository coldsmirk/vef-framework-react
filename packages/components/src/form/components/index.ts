import { Form } from "./form";
import { ResetButton } from "./reset-button";
import { SubmitButton } from "./submit-button";

export type { FormProps } from "./form";
export type { ResetButtonProps } from "./reset-button";
export type { SubmitButtonProps } from "./submit-button";

export const formComponents = {
  Form,
  SubmitButton,
  ResetButton
} as const;
