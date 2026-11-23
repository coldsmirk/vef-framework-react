import type { ReactNode } from "react";

import { useShallow } from "@vef-framework-react/core";
import { PlusIcon } from "lucide-react";

import { Button } from "../../button";
import { Icon } from "../../icon";
import { useEditableTableStore } from "../store";

export interface AddRowButtonProps {
  /**
   * Button label. Defaults to `"新增记录"`.
   */
  label?: ReactNode;
}

/**
 * Dashed full-width button that appends a new row. Disabled while a row is
 * being edited to keep the one-row-at-a-time contract.
 */
export function AddRowButton({ label }: AddRowButtonProps): ReactNode {
  const { addRow, editingKey } = useEditableTableStore(
    useShallow(state => {
      return { addRow: state.addRow, editingKey: state.editingKey };
    })
  );

  return (
    <Button block disabled={editingKey !== null} icon={<Icon component={PlusIcon} />} type="dashed" onClick={() => addRow()}>
      {label ?? "新增记录"}
    </Button>
  );
}
