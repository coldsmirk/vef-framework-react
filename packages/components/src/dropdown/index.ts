import type { DropdownProps, GetProp } from "antd";

export { Dropdown } from "antd";

export type { DropdownProps } from "antd";
export type { DropdownButtonProps, DropdownButtonType } from "antd/es/dropdown";

export type DropdownMenuProps = GetProp<DropdownProps, "menu">;
export type DropdownMenuItem = NonNullable<GetProp<DropdownMenuProps, "items">[number]>;
