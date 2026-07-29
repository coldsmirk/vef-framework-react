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

/**
 * One suggestion offered while editing a cell: `value` is the code inserted on
 * pick, `label` is what the dropdown shows (`0 = 独立科室`).
 */
export interface CodeSuggestion {
  value: string;
  label: string;
}

export interface CodeMapEntriesEditorProps {
  value?: CodeMapEntry[] | null;
  onChange?: (value: CodeMapEntry[]) => void;
  /**
   * Suggestions from the host code catalog (`mold.CodeSetInspector`) for the two
   * primary-value columns. Empty leaves them as free text — which is also the
   * state for hosts that registered no enumerable catalog.
   *
   * The external column gets them too even though the catalog describes the
   * host's* coding: in practice the two sides overlap often enough (numeric
   * levels, M/F, Y/N) that offering the list saves real typing, and the control
   * suggests rather than constrains — an external code that differs is simply
   * typed in.
   *
   * The alias columns stay plain tag inputs. A full catalog dropdown over a
   * narrow multi-value cell covers half the form for a list the operator is
   * usually not picking from — aliases are the values that fall *outside* the
   * catalog.
   */
  codeSuggestions?: CodeSuggestion[];
}

const EMPTY_OPTIONS: CodeSuggestion[] = [];

// The mapping-pair editor: each side holds one primary value and optional
// aliases (entered as tags). Cells edit the display form; typed JSON values
// are restored through parseCodeValue on change.
export function CodeMapEntriesEditor({
  value,
  onChange,
  codeSuggestions = EMPTY_OPTIONS
}: CodeMapEntriesEditorProps) {
  const [rows, setRows] = useState<EntryRow[]>(() => toRows(value ?? []));
  const seq = useRef(0);
  const synced = useRef<CodeMapEntry[]>(value ?? EMPTY_ENTRIES);

  const columns = useMemo<Array<EditableColumn<EntryRow>>>(() => [
    createEditableColumn<EntryRow>("canonical", {
      title: "标准值",
      width: 120,
      renderEditor: field => (
        <field.AutoComplete
          noWrapper
          preserveEmptyString
          options={codeSuggestions}
          placeholder="如 1"
          popupMatchSelectWidth={false}
        />
      )
    }),
    createEditableColumn<EntryRow>("canonicalAliases", {
      title: "标准别名",
      renderEditor: field => (
        <field.Select
          noWrapper
          mode="tags"
          open={false}
          placeholder="回车添加，仅参与匹配"
          style={{ width: "100%" }}
        />
      )
    }),
    createEditableColumn<EntryRow>("external", {
      title: "外部值",
      width: 120,
      renderEditor: field => (
        <field.AutoComplete
          noWrapper
          preserveEmptyString
          options={codeSuggestions}
          placeholder="如 M"
          popupMatchSelectWidth={false}
        />
      )
    }),
    createEditableColumn<EntryRow>("externalAliases", {
      title: "外部别名",
      renderEditor: field => (
        <field.Select
          noWrapper
          mode="tags"
          open={false}
          placeholder="回车添加，仅参与匹配"
          style={{ width: "100%" }}
        />
      )
    })
  ], [codeSuggestions]);

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
