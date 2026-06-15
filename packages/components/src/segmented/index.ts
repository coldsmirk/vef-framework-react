import type { IterableElement } from "@vef-framework-react/shared";
import type { SegmentedOptions, SegmentedValue } from "antd/es/segmented";

export { Segmented } from "antd";
export type { SegmentedProps } from "antd";

export type SegmentedOption<T = SegmentedValue> = IterableElement<SegmentedOptions<T>>;
