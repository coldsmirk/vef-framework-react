import type { IterableElement } from "@vef-framework-react/shared";
import type { CollapseProps, GetProp } from "antd";

export { Collapse } from "antd";

export type { CollapseProps } from "antd";
export type CollapseItem = IterableElement<GetProp<CollapseProps, "items">>;
