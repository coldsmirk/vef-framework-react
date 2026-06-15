import type { AnyObject } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { CrudProps } from "../crud";
import type { AsideWidth, Position } from "../page";

/**
 * Props for the CrudPage component, supporting both paginated and non-paginated modes.
 *
 * @template TRow - Table row model type
 * @template TSearchValues - Search/filters form values type
 * @template TSceneFormValues - A map of scene key to its form values type
 * @template TParams - Additional query parameters type
 */
export type CrudPageProps<
  TRow extends AnyObject,
  TSearchValues extends AnyObject,
  TSceneFormValues extends AnyObject,
  TParams extends AnyObject = never
> = CrudProps<TRow, TSearchValues, TSceneFormValues, TParams> & {
  /**
   * The left aside content of the page
   */
  leftAside?: ReactNode;
  /**
   * The width of the left aside
   */
  leftAsideWidth?: AsideWidth;
  /**
   * The right aside content of the page
   */
  rightAside?: ReactNode;
  /**
   * The width of the right aside
   */
  rightAsideWidth?: AsideWidth;
  /**
   * The header of the page
   */
  header?: ReactNode;
  /**
   * The class name of the header
   */
  headerClassName?: string;
  /**
   * The position of the header
   *
   * @default "inside"
   */
  headerPosition?: Position;
  /**
   * The footer of the page
   */
  footer?: ReactNode;
  /**
   * The class name of the footer
   */
  footerClassName?: string;
  /**
   * The position of the footer
   *
   * @default "inside"
   */
  footerPosition?: Position;
};
