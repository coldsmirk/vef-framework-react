import type { AnyObject } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import { useShallow } from "@vef-framework-react/core";
import { CheckIcon, PencilIcon, TrashIcon, XIcon } from "lucide-react";

import { Group } from "../../group";
import { Icon } from "../../icon";
import { OperationButton } from "../../operation-button";
import { useEditableTableStore } from "../store";

/**
 * Custom labels for the built-in row action buttons.
 */
export interface EditableRowActionsTexts {
  edit?: ReactNode;
  save?: ReactNode;
  cancel?: ReactNode;
  delete?: ReactNode;
}

interface EditableRowActionsProps<TRow extends AnyObject> {
  row: TRow;
  index: number;
  rowKey: string;
  editable: boolean;
  deletable: boolean;
  texts?: EditableRowActionsTexts;
  extra?: (row: TRow, index: number) => ReactNode;
}

/**
 * Operation-column body. Subscribes to `editingKey` to render either the
 * read-mode actions (caller extras + Edit/Delete) or the edit-mode actions
 * (Save/Cancel). While any row is editing, the other rows' buttons are disabled
 * to enforce the one-row-at-a-time contract. Save runs through ActionButton, so
 * its async work (validation) drives the loading state automatically. Buttons
 * are color-coded filled: primary for Edit/Save, danger for Delete, default for
 * Cancel.
 */
export function EditableRowActions<TRow extends AnyObject>({
  row,
  index,
  rowKey,
  editable,
  deletable,
  texts,
  extra
}: EditableRowActionsProps<TRow>): ReactNode {
  const {
    editingKey,
    startEdit,
    save,
    cancel,
    deleteRow
  } = useEditableTableStore(
    useShallow(state => {
      return {
        editingKey: state.editingKey,
        startEdit: state.startEdit,
        save: state.save,
        cancel: state.cancel,
        deleteRow: state.deleteRow
      };
    })
  );

  const editing = editingKey === rowKey;

  if (editing) {
    return (
      <Group justify="center">
        <OperationButton color="primary" icon={<Icon component={CheckIcon} />} onClick={() => save()}>
          {texts?.save ?? "保存"}
        </OperationButton>

        <OperationButton color="default" icon={<Icon component={XIcon} />} onClick={cancel}>
          {texts?.cancel ?? "取消"}
        </OperationButton>
      </Group>
    );
  }

  const blocked = editingKey !== null;

  return (
    <Group justify="center">
      {extra?.(row, index)}

      {editable && (
        <OperationButton color="primary" disabled={blocked} icon={<Icon component={PencilIcon} />} onClick={() => startEdit(rowKey, row)}>
          {texts?.edit ?? "编辑"}
        </OperationButton>
      )}

      {deletable && (
        <OperationButton color="danger" disabled={blocked} icon={<Icon component={TrashIcon} />} onClick={() => deleteRow(rowKey)}>
          {texts?.delete ?? "删除"}
        </OperationButton>
      )}
    </Group>
  );
}
