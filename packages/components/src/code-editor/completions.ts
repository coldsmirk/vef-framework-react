import type { Completion, CompletionSource } from "@codemirror/autocomplete";

/**
 * One entry of a declarative completion catalog. Entries form a tree: root
 * entries complete as globals, and an entry's `children` complete after
 * `label.` — so a catalog can describe host-injected bindings and libraries
 * without the caller touching CodeMirror APIs.
 */
export interface CompletionEntry {
  /**
   * The identifier to insert.
   */
  label: string;
  /**
   * The completion icon kind (CodeMirror vocabulary: "function", "method",
   * "property", "variable", "namespace", "class", "constant", ...). Defaults
   * to "namespace" for entries with children, else "variable".
   */
  type?: string;
  /**
   * Short signature or annotation rendered after the label, e.g. "(url, options?)".
   */
  detail?: string;
  /**
   * Documentation shown in the info panel next to the selected option.
   */
  info?: string;
  /**
   * Ranking boost (-99..99) applied when options score equally.
   */
  boost?: number;
  /**
   * Members offered after `label.`.
   */
  children?: CompletionEntry[];
}

/**
 * Walk a catalog along an object path (`["http"]` for `http.`), returning the
 * member entries to offer at that level, or null when the path leaves the
 * catalog (letting other completion sources take over).
 */
export function resolveEntryPath(
  entries: readonly CompletionEntry[],
  path: readonly string[]
): readonly CompletionEntry[] | null {
  let level: readonly CompletionEntry[] = entries;

  for (const segment of path) {
    const next = level.find(entry => entry.label === segment)?.children;

    if (!next) {
      return null;
    }

    level = next;
  }

  return level;
}

function toOption(entry: CompletionEntry): Completion {
  return {
    label: entry.label,
    type: entry.type ?? (entry.children ? "namespace" : "variable"),
    detail: entry.detail,
    info: entry.info,
    boost: entry.boost
  };
}

/**
 * A completion source over an entry catalog, named after CodeMirror's own
 * `completeFromList`. It resolves the member path before the cursor via
 * `completionPath` (loaded lazily alongside the JavaScript language pack, so
 * it never enters the initial bundle) and offers the matching level of the
 * catalog; outside the catalog it stays silent so other sources take over.
 * `completionPath` also does the gating: outside an identifier or property
 * it only yields a target on an explicit request.
 */
export function completeFromEntries(entries: readonly CompletionEntry[]): CompletionSource {
  return async context => {
    const { completionPath } = await import("@codemirror/lang-javascript");
    const target = completionPath(context);

    if (!target) {
      return null;
    }

    const level = resolveEntryPath(entries, target.path);

    if (!level) {
      return null;
    }

    return {
      from: context.pos - target.name.length,
      options: level.map(entry => toOption(entry)),
      validFor: /^[\w$]*$/
    };
  };
}
