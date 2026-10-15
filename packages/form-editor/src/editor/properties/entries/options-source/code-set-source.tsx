import type { ChangeEvent, ReactElement } from "react";

import type { CodeSetDescriptor } from "../../../../types";

import { Input, Select } from "@vef-framework-react/components";
import { useMemo, useState } from "react";

import { useCodeSetCatalog } from "../../../code-set-catalog";

const selectStyle = { width: "100%" } as const;

interface CatalogOption {
  value: string;
  label: string;
}

interface CatalogGroup {
  label: string;
  options: CatalogOption[];
}

/**
 * The catalog as picker options: ungrouped dictionaries first, then one group
 * per `group` in the order the catalog first names it. Each label carries the
 * key beside the name, so a search matches either.
 */
function toPickerOptions(catalog: CodeSetDescriptor[]): Array<CatalogOption | CatalogGroup> {
  const ungrouped: CatalogOption[] = [];
  const groups = new Map<string, CatalogOption[]>();

  for (const entry of catalog) {
    const option = { value: entry.codeSet, label: `${entry.name} · ${entry.codeSet}` };

    if (entry.group === undefined) {
      ungrouped.push(option);
    } else {
      groups.set(entry.group, [...groups.get(entry.group) ?? [], option]);
    }
  }

  return [
    ...ungrouped,
    ...[...groups].map(([label, options]) => { return { label, options }; })
  ];
}

/**
 * Editor for a `codeSet` option source: a searchable picker over the host's
 * data-dictionary catalog, or — when the host offers none — the key typed by
 * hand. A typed key is committed on blur / Enter rather than per keystroke:
 * every committed key is a dictionary the canvas loads, and the prefixes of a
 * key being typed are not dictionaries.
 */
export function CodeSetSource({
  codeSet,
  onChange
}: {
  codeSet: string;
  onChange: (codeSet: string) => void;
}): ReactElement {
  const catalog = useCodeSetCatalog();
  const options = useMemo(() => toPickerOptions(catalog), [catalog]);
  const [draft, setDraft] = useState<string | null>(null);

  if (catalog.length > 0) {
    return (
      <Select
        aria-label="数据字典"
        options={options}
        placeholder="选择数据字典"
        showSearch={{ optionFilterProp: "label" }}
        style={selectStyle}
        value={codeSet.length > 0 ? codeSet : undefined}
        onChange={value => onChange(String(value))}
      />
    );
  }

  const commit = (): void => {
    if (draft === null) {
      return;
    }

    onChange(draft.trim());
    setDraft(null);
  };

  return (
    <Input
      aria-label="数据字典"
      placeholder="数据字典编码，如 sys.user.gender"
      value={draft ?? codeSet}
      onBlur={commit}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
      onFocus={() => setDraft(codeSet)}
      onPressEnter={commit}
    />
  );
}
