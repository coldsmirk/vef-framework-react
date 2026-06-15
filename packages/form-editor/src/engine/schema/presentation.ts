import type { FormSchema, PresentationDevice, PresentationLayer, RuntimeSchema } from "../../types";

/**
 * The presentation helpers are the single bridge between the device-keyed
 * {@link FormSchema} and the per-device {@link PresentationLayer} the tree
 * engine, store, and renderer operate on. Keeping projection / write-back in one
 * place means no other module has to know the `presentations` shape.
 */

/**
 * Shared empty layer. A single stable reference (not a fresh object per call) so
 * a store selector deriving `currentLayer` for an undesigned device returns a
 * cached value — `useSyncExternalStore` would otherwise loop on a new identity
 * each render. Frozen (object AND array): `patchSchema`'s gap route
 * shallow-spreads this layer into a real schema, sharing the children array —
 * freezing turns any future in-place mutation into a loud TypeError instead of
 * silently corrupting the module constant for every store instance.
 */
const EMPTY_LAYER: PresentationLayer = Object.freeze({ children: [] });

Object.freeze(EMPTY_LAYER.children);

/**
 * The shared empty presentation layer. Used to materialize a device on first
 * edit and as the blank seed for "start from scratch".
 */
export function emptyLayer(): PresentationLayer {
  return EMPTY_LAYER;
}

/**
 * The layer designed for `device`, or `undefined` when that device has no design
 * yet. Render-time semantics: `mobile` does **not** fall back to `pc` — the
 * renderer shows an empty state instead.
 */
export function resolvePresentation(schema: FormSchema, device: PresentationDevice): PresentationLayer | undefined {
  return device === "pc" ? schema.presentations.pc : schema.presentations.mobile;
}

/**
 * The editable layer for `device`. `pc` always exists; an undesigned `mobile`
 * resolves to an empty layer so the first edit (or a drag onto the empty canvas)
 * materializes it via {@link withPresentation}.
 */
export function currentLayer(schema: FormSchema, device: PresentationDevice): PresentationLayer {
  return resolvePresentation(schema, device) ?? emptyLayer();
}

/**
 * Write `layer` back to `device`, leaving the other device and the shared data
 * layer untouched.
 */
export function withPresentation(schema: FormSchema, device: PresentationDevice, layer: PresentationLayer): FormSchema {
  return {
    ...schema,
    presentations: device === "pc"
      ? { ...schema.presentations, pc: layer }
      : { ...schema.presentations, mobile: layer }
  };
}

/**
 * Flatten a device's design and the shared data layer into the {@link
 * RuntimeSchema} the renderer / linkage engine evaluate. Returns `undefined`
 * when the device has no design yet (an undesigned mobile) — the renderer shows
 * an empty state rather than falling back to the other device.
 */
export function toRuntimeSchema(schema: FormSchema, device: PresentationDevice): RuntimeSchema | undefined {
  const layer = resolvePresentation(schema, device);

  if (layer === undefined) {
    return undefined;
  }

  return {
    ...layer,
    id: schema.id,
    variables: schema.variables,
    dataSources: schema.dataSources,
    linkage: schema.linkage
  };
}
