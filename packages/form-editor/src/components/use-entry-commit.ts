import type { KeyboardEvent } from "react";

import { isNullish } from "@vef-framework-react/shared";
import { useRef } from "react";

/**
 * Parse a raw numeric input string into a committed number, clamping into
 * `[min, max]` and rounding to `precision` decimal places. Shared by PC
 * `NumberInput` (for synchronous Enter/blur flushing before `commit`) and
 * `MobileNumber` so both presentations commit identical numeric values.
 */
export function parseNumberDraft(
  raw: string,
  min: number | undefined,
  max: number | undefined,
  precision: number | undefined
): number | undefined {
  const next = Number(raw);

  if (raw.trim() === "" || Number.isNaN(next)) {
    return undefined;
  }

  const clamped = Math.min(Math.max(next, min ?? -Infinity), max ?? Infinity);

  if (isNullish(precision)) {
    return clamped;
  }

  // `toFixed` throws a RangeError outside 0..100; the property entry clamps
  // new writes, but a hand-authored schema can still carry an out-of-range
  // precision — clamp here so a bad value degrades instead of crashing render.
  const digits = Math.min(100, Math.max(0, Math.floor(precision)));

  return Number(clamped.toFixed(digits));
}

export interface EntryCommitHandle<TValue> {
  /**
   * Call inside the control's user-driven `onChange` handler so the hook can
   * distinguish user edits from programmatic writes (e.g. `set_fields` or
   * `form.reset`).
   */
  notifyUserChange: (next: TValue) => void;
  /**
   * Whether the keyboard event occurred during an active IME composition
   * session (`compositionstart` .. `compositionend`, `nativeEvent.isComposing`,
   * or legacy WebKit `keyCode === 229`).
   */
  isComposing: (event: KeyboardEvent<HTMLElement>) => boolean;
  /**
   * Confirm the value immediately (used on Enter for single-line entry
   * controls). Updates the committed baseline so a subsequent blur does not
   * fire a duplicate commit.
   */
  commitNow: (current: TValue) => void;
  /**
   * Confirm on blur only if `current` differs from the last committed value
   * (dirty-blur semantics).
   */
  handleBlur: (current: TValue) => void;
  /**
   * Default `onKeyDown` handler for single-line text controls (preventing outer
   * `<form>` submit and firing `commitNow` on non-composing Enter).
   */
  handleKeyDown: (event: KeyboardEvent<HTMLElement>, current: TValue) => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
}

/**
 * Shared `"entry"` commit semantics for free-text / numeric controls
 * (`textfield`, `number`, `textarea`, PC and mobile):
 *
 * - Single-line (`commitOnEnter: true`): Enter confirms (preventing default
 * form submit unless IME composition is active); blur confirms when the
 * value changed since the last commit.
 * - Multi-line (`commitOnEnter: false`): Enter inserts a newline as usual;
 * only dirty blur confirms.
 * - Programmatic writes (`set_fields`, `assign`, `form.reset`) sync the
 * committed baseline silently so they never fire `commit` directly or on a
 * subsequent unmodified blur.
 */
export function useEntryCommit<TValue>(options: {
  value: TValue;
  onCommit?: () => void;
  commitOnEnter: boolean;
}): EntryCommitHandle<TValue> {
  const {
    commitOnEnter,
    onCommit,
    value
  } = options;
  const lastCommittedRef = useRef<TValue>(value);
  const lastUserValueRef = useRef<TValue>(value);
  const composingRef = useRef(false);

  // Sync baseline when `value` moves outside our own user `notifyUserChange`
  // path (programmatic write or reset). Idempotent during render.
  if (!Object.is(value, lastUserValueRef.current)) {
    lastUserValueRef.current = value;
    lastCommittedRef.current = value;
  }

  const isComposing = (event: KeyboardEvent<HTMLElement>): boolean => composingRef.current
    || event.nativeEvent.isComposing
    || event.key === "Process"
    // Safari fires `compositionend` BEFORE the confirming `keydown` with
    // `isComposing === false`, `key === "Enter"`, and legacy `keyCode === 229`.
    || event.nativeEvent.keyCode === 229;

  const commitNow = (current: TValue): void => {
    lastCommittedRef.current = current;
    onCommit?.();
  };

  return {
    notifyUserChange: next => {
      lastUserValueRef.current = next;
    },
    isComposing,
    commitNow,
    handleBlur: current => {
      if (!onCommit) {
        return;
      }

      if (!Object.is(current, lastCommittedRef.current)) {
        lastCommittedRef.current = current;
        onCommit();
      }
    },
    handleKeyDown: (event, current) => {
      if (!commitOnEnter || !onCommit || event.key !== "Enter" || isComposing(event)) {
        return;
      }

      event.preventDefault();
      commitNow(current);
    },
    handleCompositionStart: () => {
      composingRef.current = true;
    },
    handleCompositionEnd: () => {
      composingRef.current = false;
    }
  };
}
