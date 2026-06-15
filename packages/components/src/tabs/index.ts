import type { IterableElement } from "@vef-framework-react/shared";
import type { GetProp, TabsProps } from "antd";

export { Tabs, type TabsProps } from "antd";

export type TabItem = IterableElement<GetProp<TabsProps, "items">>;
