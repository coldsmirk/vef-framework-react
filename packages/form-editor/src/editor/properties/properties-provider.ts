import type {
  FieldDefinition,
  FormField,
  PropertiesDescriptor,
  PropertyEntry,
  PropertyGroup,
  PropertyTabId
} from "../../types";

import { sanitizeKey } from "../../engine/keys";
import { definePropertyEntry } from "../../types";

/**
 * Visible-in-panel order of the property tabs. The properties panel header
 * iterates this array to render the tab bar; `PROPERTY_TAB_LABELS` keeps
 * the localized text alongside.
 */
export const PROPERTY_TAB_ORDER: readonly PropertyTabId[] = [
  "props",
  "validation",
  "linkage",
  "layout"
];

export const PROPERTY_TAB_LABELS: Record<PropertyTabId, string> = {
  props: "属性",
  validation: "校验",
  linkage: "联动",
  layout: "布局"
};

/**
 * Build the descriptor for a selected field by merging the auto-injected
 * "general" + "linkage" groups with the field type's own descriptor.
 *
 * The auto-injected groups are forced into their own tabs. If the field
 * type already declares a `general` or `linkage` group, its entries are
 * appended to the injected one rather than producing a duplicate section
 * in the panel.
 *
 * The descriptor depends only on the field's `definition` (its type), not
 * on the field instance itself — per-field visibility decisions live on
 * each entry's `visible(field)` predicate and are evaluated at render time
 * by the panel.
 */
export function buildPropertiesDescriptor(
  definition: FieldDefinition
): PropertiesDescriptor {
  const injectedGeneral: PropertyGroup = {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<FormField, string>({
        id: "id",
        label: "字段 ID",
        type: "text",
        readOnly: true,
        read: field => field.id,
        // Read-only entries never trigger a write — keep `write` as an
        // identity so the lens contract is satisfied without branching at
        // call sites.
        write: field => field
      })
    ]
  };
  const injectedLinkage: PropertyGroup = {
    id: "linkage",
    // No group heading: the linkage entry renders its own titled card, and a
    // second identical "联动规则" line right above it read as a stutter.
    label: "",
    tab: "linkage",
    entries: [
      definePropertyEntry<FormField, FormField["linkage"]>({
        id: "linkageRules",
        label: "联动规则",
        type: "linkage-rules",
        description: "当其他字段满足条件时，对本字段执行显示、禁用、必填或赋值动作",
        read: field => field.linkage,
        write: (field, linkage) => { return { ...field, linkage }; }
      })
    ]
  };

  if (definition.config.keyed) {
    injectedGeneral.entries.push(
      definePropertyEntry<FormField & { key: string }, string>({
        id: "key",
        label: "字段 Key",
        type: "key",
        description: "提交时用作 JSON 键名",
        read: field => field.key,
        // Sanitize to a binding-safe, non-empty key. Live edits route through
        // the store's `setFieldKey`, which also de-duplicates within the value
        // scope; this lens keeps the declarative write self-consistent.
        write: (field, key) => {
          const next = sanitizeKey(key);

          return next.length > 0 ? { ...field, key: next } : field;
        }
      })
    );
  }

  const groups: PropertyGroup[] = [injectedGeneral, injectedLinkage];
  const seen = new Map<string, PropertyGroup>([
    [injectedGeneral.id, injectedGeneral],
    [injectedLinkage.id, injectedLinkage]
  ]);

  for (const group of definition.properties) {
    const existing = seen.get(group.id);

    if (existing) {
      existing.entries = [...existing.entries, ...group.entries];
      continue;
    }

    const cloned: PropertyGroup = {
      ...group,
      // Default any group that does not opt into a tab to `props` so the
      // panel always has somewhere to render it.
      tab: group.tab ?? "props",
      entries: [...group.entries]
    };
    groups.push(cloned);
    seen.set(group.id, cloned);
  }

  return groups;
}

/**
 * Slice the descriptor down to the groups assigned to a given tab. The
 * properties panel uses this to render one tab at a time.
 */
export function groupsForTab(
  descriptor: PropertiesDescriptor,
  tab: PropertyTabId
): PropertyGroup[] {
  return descriptor.filter(group => (group.tab ?? "props") === tab);
}

/**
 * Count the entries on a tab that are *configured* on the given field —
 * i.e. carry a meaningful, non-default value. Used to render the count
 * badge next to each tab name.
 *
 * The "configured" predicate is intentionally simple so it matches what a
 * user would visually call a "set" field: any non-empty, non-falsy value.
 * Read-only entries (like `id`) are excluded so the auto-injected general
 * fields do not inflate the count.
 *
 * Entries hidden by `visible(field)` are excluded so the count matches the
 * visible state of the tab.
 */
export function countConfiguredEntries(
  field: FormField,
  descriptor: PropertiesDescriptor,
  tab: PropertyTabId
): number {
  let count = 0;

  for (const group of groupsForTab(descriptor, tab)) {
    for (const entry of group.entries) {
      count += countConfiguredEntry(field, entry);
    }
  }

  return count;
}

function countConfiguredEntry(field: FormField, entry: PropertyEntry): number {
  if (entry.readOnly) {
    return 0;
  }

  if (entry.visible && !entry.visible(field)) {
    return 0;
  }

  // The linkage badge counts RULES, not "a linkage object exists": an
  // emptied `{ rules: [] }` payload must read as zero, and three rules
  // should badge 3, not 1.
  if (entry.type === "linkage-rules") {
    const linkage = entry.read(field) as FormField["linkage"];
    return linkage?.rules?.length ?? 0;
  }

  return isEntryConfigured(field, entry) ? 1 : 0;
}

function isEntryConfigured(field: FormField, entry: PropertyEntry): boolean {
  const value = entry.read(field);

  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.length > 0;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return Boolean(value);
}
