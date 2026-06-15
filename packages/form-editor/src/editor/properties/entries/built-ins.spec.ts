import { BUILT_IN_PROPERTY_ENTRIES } from "./built-ins";
import { CheckboxEntry } from "./checkbox-entry";
import { NumberEntry } from "./number-entry";
import { OptionsSourceEntry } from "./options-source";
import { SelectEntry } from "./select-entry";
import { TextEntry } from "./text-entry";

describe("BUILT_IN_PROPERTY_ENTRIES", () => {
  it("maps every built-in entry type to its renderer", () => {
    // The record is the panel's tree-shaking-safe fallback: a missing mapping
    // here would render "未注册的属性编辑器" for that type in every published
    // build, so each built-in type is pinned to its component. The linkage
    // entry is a lazy boundary (it anchors the CodeMirror chunk), so only its
    // presence is asserted.
    expect(BUILT_IN_PROPERTY_ENTRIES.text).toBe(TextEntry);
    expect(BUILT_IN_PROPERTY_ENTRIES.number).toBe(NumberEntry);
    expect(BUILT_IN_PROPERTY_ENTRIES.checkbox).toBe(CheckboxEntry);
    expect(BUILT_IN_PROPERTY_ENTRIES.select).toBe(SelectEntry);
    expect(BUILT_IN_PROPERTY_ENTRIES["options-editor"]).toBe(OptionsSourceEntry);
    expect(BUILT_IN_PROPERTY_ENTRIES["linkage-rules"]).toBeDefined();
  });
});
