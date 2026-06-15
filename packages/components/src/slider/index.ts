import type { GetProps, Slider } from "antd";

export { Slider } from "antd";

export type { SliderSingleProps } from "antd";
export type { SliderRangeProps } from "antd/es/slider";
export type SliderProps = GetProps<typeof Slider>;
