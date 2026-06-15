import type { FC } from "react";

import type { ContainerChromeSet, EntryComponentProps, EntryType, FieldDefinition } from "../../types";

type Listener = () => void;

/**
 * Runtime registry of field types and property-entry renderers.
 *
 * Editor surfaces (palette, canvas, properties panel) read from the registry
 * to discover available fields and editors. The registry is intentionally
 * mutable so consumers can register custom fields and entry renderers at
 * boot or even on the fly; subscribers are notified on every mutation so
 * surfaces can re-render without a full reload.
 */
export class FormFieldRegistry {
  private readonly fields = new Map<string, FieldDefinition>();
  private readonly entries = new Map<EntryType, FC<EntryComponentProps>>();
  private readonly listeners = new Set<Listener>();
  private containerChrome: ContainerChromeSet | undefined;
  /**
   * Monotonic version bumped on every mutation. Consumers using
   * `useSyncExternalStore` snapshot this number to know when to re-read.
   */
  private revision = 0;

  register(definition: FieldDefinition): void {
    this.fields.set(definition.config.type, definition);
    this.notify();
  }

  unregister(type: string): boolean {
    const removed = this.fields.delete(type);

    if (removed) {
      this.notify();
    }

    return removed;
  }

  get(type: string): FieldDefinition | undefined {
    return this.fields.get(type);
  }

  has(type: string): boolean {
    return this.fields.has(type);
  }

  list(): FieldDefinition[] {
    return [...this.fields.values()];
  }

  /**
   * Register a property-entry renderer for an `EntryType` on this instance.
   * The properties panel resolves entries through {@link getPropertyEntry},
   * so consumers can either override a built-in entry (e.g. swap the default
   * text input) or add an entirely new entry type after augmenting
   * `PropertyEntryTypeMap`.
   */
  registerPropertyEntry(type: EntryType, component: FC<EntryComponentProps>): void {
    this.entries.set(type, component);
    this.notify();
  }

  /**
   * Resolve an entry renderer registered on this instance. The properties
   * panel falls back to its statically imported built-ins
   * (`editor/properties/entries/built-ins.ts`) when this returns `undefined`,
   * so the engine layer never references editor code and the wiring survives
   * downstream tree-shaking. Property entries are a design-time concern — a
   * renderer-only host neither registers nor reads them.
   */
  getPropertyEntry(type: EntryType): FC<EntryComponentProps> | undefined {
    return this.entries.get(type);
  }

  /**
   * Install the device's container chrome — the presentational shells for
   * `section` / `tabs` / `subform`. Set once when the registry is built
   * ({@link createDefaultRegistry} / `createDefaultMobileRegistry`); resolved by
   * the renderer and canvas through {@link getContainerChrome}.
   */
  setContainerChrome(chrome: ContainerChromeSet): void {
    this.containerChrome = chrome;
    this.notify();
  }

  /**
   * The device's container chrome. Throws when none is registered — a registry
   * that renders containers must have chrome installed; building it via the
   * `createDefault*Registry` helpers guarantees this.
   */
  getContainerChrome(): ContainerChromeSet {
    if (!this.containerChrome) {
      throw new Error(
        "Container chrome is not registered on this FormFieldRegistry. "
        + "Build it via createDefaultRegistry / createDefaultMobileRegistry, or call setContainerChrome()."
      );
    }

    return this.containerChrome;
  }

  /**
   * Subscribe to registry mutations. Returns an unsubscribe function.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Snapshot used by `useSyncExternalStore`. The value itself is opaque;
   * only its identity (changing on every mutation) matters.
   */
  getRevision(): number {
    return this.revision;
  }

  private notify(): void {
    this.revision += 1;

    for (const listener of this.listeners) {
      listener();
    }
  }
}

/**
 * One {@link FormFieldRegistry} per target device. The editor and renderer
 * resolve the active registry from the current {@link PresentationDevice}, so
 * the palette, properties panel, and field renderers all switch with the device.
 * `pc` and `mobile` may register different field sets / renderers / defaults.
 */
export interface DeviceRegistries {
  pc: FormFieldRegistry;
  mobile: FormFieldRegistry;
}
