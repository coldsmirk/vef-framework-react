import type { FC, ReactNode } from "react";

import type { ExpressionLocale } from "../engine/messages";

import { Suspense } from "react";

import { getEngineError, getEngineSync, isEngineReady, loadEngine } from "../engine/loader";
import { setExpressionLocale } from "../engine/messages";
import { ExpressionEngineContext } from "./context";

export interface ExpressionEngineProviderProps {
  children: ReactNode;
  /**
   * Shown while the wasm engine is loading. Children do not render — and thus no
   * synchronous evaluation runs — until the engine is ready, so anything inside
   * can rely on the engine being initialized.
   */
  fallback?: ReactNode;
  /**
   * Language for engine-produced descriptive text (built-in descriptions and
   * diagnostic labels). Omitted leaves the module default (`"en-US"`) untouched.
   * Equivalent to calling {@link setExpressionLocale} — provided here for hosts
   * that already wrap their tree in this provider.
   */
  locale?: ExpressionLocale;
}

/**
 * Suspends on the shared engine promise until the wasm is ready, then publishes
 * the initialized engine (read from the loader's single cache, not a second
 * one) to descendants.
 */
function EngineGate({ children }: { children: ReactNode }): ReactNode {
  if (!isEngineReady()) {
    const error = getEngineError();

    if (error) {
      // Surface a wasm-load failure to the nearest error boundary rather than
      // re-suspending on a fresh load forever.
      throw error;
    }

    throw loadEngine();
  }

  // getEngineSync returns the module-level frozen singleton, so the context
  // value is stable across renders despite coming from a call.
  // eslint-disable-next-line @eslint-react/no-unstable-context-value -- stable module singleton
  const engine = getEngineSync();

  return <ExpressionEngineContext value={engine}>{children}</ExpressionEngineContext>;
}

/**
 * Loads the ZEN engine and gates its subtree behind `<Suspense>` until the wasm
 * is initialized. Descendants read the engine via {@link useExpressionEngine}.
 */
export const ExpressionEngineProvider: FC<ExpressionEngineProviderProps> = ({
  children,
  fallback = null,
  locale
}) => {
  // Apply the locale before the gated subtree renders, so the synchronous editor
  // accessors (completion / hover / lint) read it. Idempotent module-global set,
  // matching how the engine singleton itself is configured.
  if (locale !== undefined) {
    setExpressionLocale(locale);
  }

  return (
    <Suspense fallback={fallback}>
      <EngineGate>{children}</EngineGate>
    </Suspense>
  );
};
