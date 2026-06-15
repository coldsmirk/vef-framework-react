import type { ReactElement, ReactNode } from "react";

import type { DeviceRegistries, FormFieldRegistry } from "../engine/registry/form-field-registry";
import type { ContainerChromeSet, PresentationDevice } from "../types";

import { createContext, use, useCallback, useSyncExternalStore } from "react";

const RegistryContext = createContext<DeviceRegistries | null>(null);

RegistryContext.displayName = "FormEditorRegistryContext";

/**
 * The device whose registry {@link useFieldRegistry} resolves. The editor syncs
 * this to the store's `device`; the standalone renderer sets it from its
 * `device` prop. Defaults to `"pc"` so a bare {@link RegistryProvider} (e.g. in
 * a host that does not switch devices) keeps working.
 */
const DeviceContext = createContext<PresentationDevice>("pc");

DeviceContext.displayName = "FormEditorDeviceContext";

export interface RegistryProviderProps {
  registries: DeviceRegistries;
  children: ReactNode;
}

/**
 * Inject the per-device field registries into the React tree. Store injection is
 * handled separately by `FormEditorStoreProvider` (built on `createComponentStore`).
 */
export function RegistryProvider({
  children,
  registries
}: RegistryProviderProps): ReactElement {
  return (
    <RegistryContext value={registries}>
      {children}
    </RegistryContext>
  );
}

export interface DeviceProviderProps {
  device: PresentationDevice;
  children: ReactNode;
}

/**
 * Set the active device for registry resolution. Every {@link useFieldRegistry}
 * consumer (palette, properties panel, field renderers) switches with it.
 */
export function DeviceProvider({
  children,
  device
}: DeviceProviderProps): ReactElement {
  return (
    <DeviceContext value={device}>
      {children}
    </DeviceContext>
  );
}

/**
 * The active presentation device. Renderers that branch on device — e.g. the
 * subform's `table` variant, which mounts the desktop `EditableTable` only on
 * PC and falls back to the stacked layout on mobile — read it here.
 */
export function useDevice(): PresentationDevice {
  return use(DeviceContext);
}

/**
 * The full per-device registry set. Consumers that need a specific device's
 * registry regardless of the active one (e.g. the PC → mobile converter, which
 * targets the mobile registry) read it here.
 */
export function useDeviceRegistries(): DeviceRegistries {
  const registries = use(RegistryContext);

  if (!registries) {
    throw new Error("A <RegistryProvider> ancestor is required to read the field registry.");
  }

  return registries;
}

/**
 * Subscribe to the field registry for the active device. Components that read
 * from the registry (palette, properties panel, field renderers) re-render
 * automatically when the device switches or when fields / property-entry
 * renderers are added/removed at runtime.
 *
 * The hook returns the registry instance itself; identity is stable across
 * re-renders for a given device — the re-render is triggered by a separate
 * revision snapshot managed by `useSyncExternalStore`.
 */
export function useFieldRegistry(): FormFieldRegistry {
  const registries = useDeviceRegistries();
  const device = useDevice();
  const registry = registries[device];

  // Subscribe so consumers re-render on register/unregister. `subscribe` is
  // memoized per registry so a device switch (a different registry instance)
  // re-subscribes, but an ordinary re-render does not. The snapshot is the
  // registry's revision counter; identity changes on every mutation.
  useSyncExternalStore(
    useCallback(callback => registry.subscribe(callback), [registry]),
    () => registry.getRevision(),
    () => registry.getRevision()
  );

  return registry;
}

/**
 * The active device's container chrome — the presentational shells for
 * `section` / `tabs` / `subform`. Resolved from the active registry, so it
 * switches with the device exactly like {@link useFieldRegistry}.
 */
export function useContainerChrome(): ContainerChromeSet {
  return useFieldRegistry().getContainerChrome();
}
