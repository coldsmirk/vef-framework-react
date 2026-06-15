import type { DefaultOptionType } from "antd/es/select";

export {
  useDataOptionsSelect,
  useDictionaryOptionsSelect,
  type UseDataOptionsSelectOptions,
  type UseDictionaryOptionsSelectOptions,
  type UseDictionaryOptionsSelectResult
} from "./hooks";
export { Select } from "antd";

export type SelectOption = DefaultOptionType;

export type { SelectProps } from "antd";
