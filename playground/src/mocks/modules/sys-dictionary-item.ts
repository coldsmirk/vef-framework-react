import { createCrudMock } from "../helpers/crud";
import { DICTIONARY_ITEMS, DICTIONARY_TYPES } from "./sys-dictionary";

interface DictionaryItemRow {
  id: string;
  dictionaryId: string;
  name: string;
  code: string;
  sortOrder: number;
  remark?: string | null;
  isActive: boolean;
  isVisible: boolean;
}

// Seed dictionary items from the find_items registry so the CRUD table
// shows realistic rows and stays consistent with dropdown values.
const initial: DictionaryItemRow[] = [];

for (const type of DICTIONARY_TYPES) {
  const items = DICTIONARY_ITEMS[type.key] ?? [];

  for (const [idx, opt] of items.entries()) {
    initial.push({
      id: `dict-item-${type.key}-${opt.value}`,
      dictionaryId: type.id,
      name: opt.label,
      code: String(opt.value),
      sortOrder: idx + 1,
      isActive: true,
      isVisible: true,
      remark: null
    });
  }
}

const handle = createCrudMock<DictionaryItemRow>({
  resource: "sys/dictionary_item",
  seed: 0,
  searchFields: ["name", "code"],
  where: (items, params) => {
    const dictionaryId = typeof params.dictionaryId === "string" ? params.dictionaryId : undefined;
    return dictionaryId ? items.filter(it => it.dictionaryId === dictionaryId) : items;
  },
  factory: () => {
    return {
      id: "",
      dictionaryId: "",
      name: "",
      code: "",
      sortOrder: 0,
      isActive: true,
      isVisible: true
    };
  }
});

for (const row of initial) {
  handle.add(row);
}
