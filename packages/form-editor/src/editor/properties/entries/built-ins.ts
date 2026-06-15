import type { ComponentType } from "react";

import type { EntryComponentProps, EntryType } from "../../../types";

import { lazy } from "react";

import { CheckboxEntry } from "./checkbox-entry";
import { IconEntry } from "./icon-entry";
import { KeyEntry } from "./key-entry";
import { NumberEntry } from "./number-entry";
import { OptionsSourceEntry } from "./options-source";
import { SelectEntry } from "./select-entry";
import { TextEntry } from "./text-entry";

// The linkage entry anchors the heaviest editor subtree (rule machinery plus
// the CodeMirror-backed expression editor); loading it when the 联动 tab first
// renders keeps all of that out of the editor's first paint. The panel wraps
// entries in a Suspense boundary.
const LinkageRulesEntry = lazy(async () => {
  const module = await import("./linkage");

  return { default: module.LinkageRulesEntry };
});

/**
 * Built-in property-entry renderers, resolved by the properties panel as the
 * fallback behind per-instance {@link FormFieldRegistry.registerPropertyEntry}
 * overrides.
 *
 * A statically imported record (rather than a side-effect registration at
 * module-evaluation time) keeps the wiring bundler-proof: the package ships
 * `"sideEffects": ["*.css"]`, so a bare side-effect import would be tree-shaken
 * out of downstream production builds, leaving every entry type unregistered.
 * The record lives in the editor layer next to its only consumer, so the
 * engine registry still never imports editor code and a renderer-only host
 * bundles none of the panel tree.
 *
 * `Partial` because `EntryType` is open for module augmentation — types added
 * by a host exist in the union but have no built-in renderer here.
 */
export const BUILT_IN_PROPERTY_ENTRIES: Partial<Record<EntryType, ComponentType<EntryComponentProps>>> = {
  text: TextEntry,
  key: KeyEntry,
  number: NumberEntry,
  checkbox: CheckboxEntry,
  select: SelectEntry,
  icon: IconEntry,
  "options-editor": OptionsSourceEntry,
  "linkage-rules": LinkageRulesEntry
};
