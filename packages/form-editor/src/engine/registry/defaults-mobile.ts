import { mobileFieldDefinitions } from "../../components/mobile/definitions";
import { mobileContainerChrome } from "../../render/chrome/mobile-chrome";
import { FormFieldRegistry } from "./form-field-registry";

/**
 * Build the default **mobile** field registry: antd-mobile leaf renderers and
 * the antd-mobile container chrome.
 *
 * Like {@link createDefaultRegistry}, this registers no property-entry
 * renderers — property editing is a design-time concern shared across devices,
 * resolved by the properties panel from its statically imported built-ins
 * (`editor/properties/entries/built-ins.ts`), so a renderer-only host never
 * bundles the editor's properties-panel tree.
 *
 * Kept in its own module so a pure-PC consumer that only ever builds
 * {@link createDefaultRegistry} never pulls antd-mobile into its bundle — the
 * `sideEffects: ["*.css"]` package config tree-shakes this module out when it is
 * not referenced.
 */
export function createDefaultMobileRegistry(): FormFieldRegistry {
  const registry = new FormFieldRegistry();

  for (const definition of mobileFieldDefinitions) {
    registry.register(definition);
  }

  registry.setContainerChrome(mobileContainerChrome);

  return registry;
}
