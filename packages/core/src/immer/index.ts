/* eslint-disable unicorn/no-top-level-side-effects -- This module configures Immer before re-exporting its APIs. */
import { enableMapSet, enablePatches, setAutoFreeze } from "immer";

// Enable Map and Set support for immutable operations
enableMapSet();

// Enable patches for tracking changes (useful for undo/redo, sync)
enablePatches();

// Disable auto-freeze for better performance in development
// Note: Frozen objects throw errors when mutated, which helps catch bugs
// but adds overhead. Disable in production-like environments.
setAutoFreeze(false);

// Core Immer exports
export {
  applyPatches,
  current as currentState,
  original as originalState,
  produce,
  produceWithPatches
} from "immer";

// React hooks for Immer integration
export { useImmer, useImmerReducer } from "use-immer";
