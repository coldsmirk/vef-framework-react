import type { EditableColumn } from "@vef-framework-react/components";

import type { CodeMapEntry } from "../../types";

import { createEditableColumn, EditableTable } from "@vef-framework-react/components";
import { useMemo, useRef, useState } from "react";

import { formatCodeValue, parseCodeValue } from "./model";

interface EntryRow {
  id: string;
  canonical: string;
  canonicalAliases: string[];
  external: string;
  externalAliases: string[];
}

function toRows(entries: CodeMapEntry[]): EntryRow[] {
  return entries.map((entry, index) => {
    return {
      id: `row-${index}`,
      canonical: formatCodeValue(entry.canonical),
      canonicalAliases: (entry.canonicalAliases ?? []).map(alias => formatCodeValue(alias)),
      external: formatCodeValue(entry.external),
      externalAliases: (entry.externalAliases ?? []).map(alias => formatCodeValue(alias))
    };
  });
}

function toEntries(rows: EntryRow[]): CodeMapEntry[] {
  const entries: CodeMapEntry[] = [];

  for (const row of rows) {
    if (!row.canonical && !row.external && row.canonicalAliases.length === 0 && row.externalAliases.length === 0) {
      continue;
    }

    const entry: CodeMapEntry = {
      canonical: parseCodeValue(row.canonical),
      external: parseCodeValue(row.external)
    };

    if (row.canonicalAliases.length > 0) {
      entry.canonicalAliases = row.canonicalAliases.map(alias => parseCodeValue(alias));
    }

    if (row.externalAliases.length > 0) {
      entry.externalAliases = row.externalAliases.map(alias => parseCodeValue(alias));
    }

    entries.push(entry);
  }

  return entries;
}

const EMPTY_ENTRIES: CodeMapEntry[] = [];

function sameEntries(a: CodeMapEntry[], b: CodeMapEntry[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface CodeMapEntriesEditorProps {
  value?: CodeMapEntry[] | null;
  onChange?: (value: CodeMapEntry[]) => void;
}

// The mapping-pair editor: each side holds one primary value and optional
// aliases (entered as tags). Cells edit the display form; typed JSON values
// are restored through parseCodeValue on change.
export function CodeMapEntriesEditor({ value, onChange }: CodeMapEntriesEditorProps) {
  const [rows, setRows] = useState<EntryRow[]>(() => toRows(value ?? []));
  const seq = useRef(0);
  const synced = useRef<CodeMapEntry[]>(value ?? EMPTY_ENTRIES);

  const columns = useMemo<Array<EditableColumn<EntryRow>>>(() => [
    createEditableColumn<EntryRow>("canonical", {
      title: "标准值",
      width: "18%",
      renderEditor: field => <field.Input noWrapper placeholder="如 1" />
    }),
    createEditableColumn<EntryRow>("canonicalAliases", {
      title: "标准别名",
      width: "32%",
      renderEditor: field => <field.Select noWrapper mode="tags" open={false} placeholder="回车添加，仅参与匹配" />
    }),
    createEditableColumn<EntryRow>("external", {
      title: "外部值",
      width: "18%",
      renderEditor: field => <field.Input noWrapper placeholder="如 M" />
    }),
    createEditableColumn<EntryRow>("externalAliases", {
      title: "外部别名",
      width: "32%",
      renderEditor: field => <field.Select noWrapper mode="tags" open={false} placeholder="回车添加，仅参与匹配" />
    })
  ], []);

  // Resync when the parent replaces `value` externally (form reset, loading a
  // record). Edits made here round-trip through `toEntries(rows)`, so they
  // match the current projection and never look like an external change.
  const external = value ?? EMPTY_ENTRIES;

  if (external !== synced.current && !sameEntries(external, toEntries(rows))) {
    synced.current = external;
    setRows(toRows(external));
  }

  return (
    <EditableTable<EntryRow>
      canDelete
      creatable
      columns={columns}
      locale={{ emptyText: "暂无映射条目" }}
      rowKey="id"
      size="small"
      value={rows}
      createRecord={() => {
        return {
          id: `new-${seq.current++}`,
          canonical: "",
          canonicalAliases: [],
          external: "",
          externalAliases: []
        };
      }}
      onChange={next => {
        setRows(next);
        onChange?.(toEntries(next));
      }}
    />
  );
}
