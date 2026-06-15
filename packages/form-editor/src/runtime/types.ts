import type { FormApi } from "@vef-framework-react/components";

import type { RuntimeFieldState } from "../engine/linkage";

export type RuntimeFormValues = Record<string, unknown>;

export type RuntimeStateMap = Record<string, RuntimeFieldState>;

/**
 * The runtime form instance the renderer drives. Aliased here (not re-declared
 * per file) so the state controller, effect lane, and `FormRenderer` share one
 * shape. The validator generics are deliberately `any` — TanStack's `AnyFormApi`
 * convention: `FormApi` is invariant in them, and the runtime lane only drives
 * values / submission, so it must accept the renderer's form regardless of
 * which form-level validators it registers (e.g. the schema-driven submit gate).
 */
export type RuntimeForm = FormApi<RuntimeFormValues, any, any, any, any, any, any, any, any, any, any>;
