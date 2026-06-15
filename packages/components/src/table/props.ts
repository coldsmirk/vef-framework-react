import type { AnyObject, Except } from "@vef-framework-react/shared";
import type { TableProps as TablePropsInternal } from "antd";

/**
 * The props for the table component.
 */
export interface TableProps<TRow = AnyObject> extends Except<TablePropsInternal<TRow>, "scroll"> {
  /**
   * Whether the table height is fixed and should be calculated automatically.
   *
   * @default true
   */
  flexHeight?: boolean;
  /**
   * Render zebra-striped rows: every second body row gets a subtle fill so wide
   * tables stay scannable. Composes with `rowClassName`, and hover / selection
   * feedback still applies.
   *
   * @default false
   */
  striped?: boolean;
}
