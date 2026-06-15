import { buttonDefinition } from "../../components/button";
import { checkboxGroupFieldDefinition } from "../../components/checkbox-group-field";
import { codeEditorDefinition } from "../../components/code-editor";
import { flexDefinition, gridDefinition, sectionDefinition, subformDefinition, tabsDefinition } from "../../components/containers";
import { dateFieldDefinition, dateRangeFieldDefinition, datetimeFieldDefinition } from "../../components/date-field";
import { alertBlockDefinition, dividerDefinition, paragraphDefinition } from "../../components/display";
import { numberFieldDefinition } from "../../components/number-field";
import { radioFieldDefinition } from "../../components/radio-field";
import { selectFieldDefinition } from "../../components/select-field";
import { switchFieldDefinition } from "../../components/switch-field";
import { textareaFieldDefinition } from "../../components/textarea-field";
import { textfieldDefinition } from "../../components/textfield";
import { pcContainerChrome } from "../../render/chrome/pc-chrome";
import { FormFieldRegistry } from "./form-field-registry";

/**
 * Register the built-in field definitions (runtime `Component` + chrome) on
 * the given registry.
 *
 * Deliberately registers **no** property-entry renderers: those are
 * design-time editor UI, resolved by the properties panel from its statically
 * imported built-ins (`editor/properties/entries/built-ins.ts`). Keeping them
 * out of this module means a renderer-only host that builds
 * {@link createDefaultRegistry} never pulls the editor's properties-panel tree
 * into its bundle.
 */
export function registerDefaults(registry: FormFieldRegistry): void {
  registry.register(textfieldDefinition);
  registry.register(codeEditorDefinition);
  registry.register(numberFieldDefinition);
  registry.register(switchFieldDefinition);
  registry.register(selectFieldDefinition);
  registry.register(radioFieldDefinition);
  registry.register(checkboxGroupFieldDefinition);
  registry.register(textareaFieldDefinition);
  registry.register(dateFieldDefinition);
  registry.register(datetimeFieldDefinition);
  registry.register(dateRangeFieldDefinition);
  registry.register(buttonDefinition);
  registry.register(sectionDefinition);
  registry.register(tabsDefinition);
  registry.register(subformDefinition);
  registry.register(flexDefinition);
  registry.register(gridDefinition);
  registry.register(dividerDefinition);
  registry.register(alertBlockDefinition);
  registry.register(paragraphDefinition);

  registry.setContainerChrome(pcContainerChrome);
}

/**
 * Build a fresh registry pre-populated with the built-in field definitions
 * and the PC container chrome.
 *
 * Convenience helper used by `<FormEditor />` when the consumer does not
 * supply its own registry. Exported so callers that want to extend the
 * defaults can compose on top of it.
 */
export function createDefaultRegistry(): FormFieldRegistry {
  const registry = new FormFieldRegistry();
  registerDefaults(registry);
  return registry;
}
