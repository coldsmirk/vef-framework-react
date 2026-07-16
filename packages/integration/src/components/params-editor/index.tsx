import type { EditableColumn } from "@vef-framework-react/components";

import { createEditableColumn, EditableTable } from "@vef-framework-react/components";
import { useRef, useState } from "react";

interface ParamRow {
  id: string;
  key: string;
  value: string;
}

function toRows(record: Record<string, string>): ParamRow[] {
  return Object.entries(record).map(([key, value], index) => {
    return {
      id: `row-${index}`,
      key,
      value
    };
  });
}

function toRecord(rows: ParamRow[]): Record<string, string> {
  const record: Record<string, string> = {};

  for (const row of rows) {
    if (row.key) {
      record[row.key] = row.value;
    }
  }

  return record;
}

const EMPTY_RECORD: Record<string, string> = {};

function sameRecord(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);

  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key]);
}

const columns: Array<EditableColumn<ParamRow>> = [
  createEditableColumn<ParamRow>("key", {
    title: "参数名",
    renderEditor: field => <field.Input noWrapper placeholder="参数名" />
  }),
  createEditableColumn<ParamRow>("value", {
    title: "参数值",
    renderEditor: field => <field.Input noWrapper placeholder="参数值" />
  })
];

export interface ParamsEditorProps {
  value?: Record<string, string> | null;
  onChange?: (value: Record<string, string>) => void;
}

// A key-value editor over a `Record<string, string>`, bridging it to the
// array-shaped EditableTable with synthetic row ids.
export function ParamsEditor({ value, onChange }: ParamsEditorProps) {
  const [rows, setRows] = useState<ParamRow[]>(() => toRows(value ?? {}));
  const seq = useRef(0);
  const synced = useRef<Record<string, string>>(value ?? EMPTY_RECORD);

  // Resync when the parent replaces `value` externally (form reset, loading a
  // record, a programmatic set). Edits made here round-trip through
  // `toRecord(rows)`, so they match the current projection and never look like
  // an external change; the ref guard also stops a resynced value from looping.
  const external = value ?? EMPTY_RECORD;

  if (external !== synced.current && !sameRecord(external, toRecord(rows))) {
    synced.current = external;
    setRows(toRows(external));
  }

  return (
    <EditableTable<ParamRow>
      canDelete
      creatable
      columns={columns}
      locale={{ emptyText: "暂无参数" }}
      rowKey="id"
      size="small"
      value={rows}
      createRecord={() => {
        return {
          id: `new-${seq.current++}`,
          key: "",
          value: ""
        };
      }}
      onChange={next => {
        setRows(next);
        onChange?.(toRecord(next));
      }}
    />
  );
}
