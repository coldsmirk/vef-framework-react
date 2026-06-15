import type { Except } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { ResetButtonProps, SubmitButtonProps } from "../form";

/**
 * Props for the ProSearch component
 *
 * @template TValues - The type of the search form values
 */
export interface ProSearchProps<TValues = unknown> {
  /**
   * CSS class name
   */
  className?: string;
  /**
   * Default search values
   */
  defaultValues?: TValues;
  /**
   * Extra content on the left side
   */
  extra?: ReactNode;
  /**
   * Basic search content
   */
  basicSearch?: ReactNode;
  /**
   * Advanced search content
   */
  advancedSearch?: ReactNode;
  /**
   * Disabled state
   */
  disabled?: boolean;
  /**
   * Loading state
   */
  loading?: boolean;
  /**
   * Search button props
   */
  searchButtonProps?: Except<SubmitButtonProps, "onSubmit" | "disabled" | "loading">;
  /**
   * Reset button props, or false to hide the reset button
   */
  resetButtonProps?: Except<ResetButtonProps, "onReset" | "disabled" | "loading"> | false;
  /**
   * Callback when search values change
   */
  onSearch?: (values: NoInfer<TValues>) => void;
  /**
   * Callback when search is reset
   */
  onReset?: (defaultValues?: NoInfer<TValues>) => void;
  /**
   * Whether advanced search is visible by default (uncontrolled)
   */
  defaultAdvancedSearchVisible?: boolean;
  /**
   * Whether advanced search is visible (controlled)
   */
  advancedSearchVisible?: boolean;
  /**
   * Callback when advanced search visibility changes
   */
  onAdvancedSearchVisibleChange?: (visible: boolean) => void;
}
