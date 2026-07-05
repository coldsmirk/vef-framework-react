/**
 * Detects cycles in the linkage dependency graph. Each entry maps a
 * source field key to the set of target field keys that depend on it;
 * the validator builds this graph from the condition trees of rules that
 * WRITE a value (`assign` / `script` state actions) — level-stable state
 * actions (`show` / `hide` / `enable` / `disable` / `require` / `optional`)
 * never feed values back, so they create no edges.
 *
 * Cycles must be reported before the schema reaches the renderer —
 * otherwise `evaluateRuntimeStates` would loop in the host's React
 * render-update cycle (one field's `assign` triggers another's
 * recomputation, which writes back, etc.).
 *
 * LIMITATION: the graph is built only from trigger-condition source keys
 * (see `collectConditionSourceKeys`), NOT from the data referenced inside
 * `assign` / `set_field` value expressions, which are opaque to static
 * analysis. Two fields that assign each other's value via expression therefore
 * form a runtime loop this detector cannot see — authors must avoid mutual
 * expression-assignment. The runtime's `stabilizeStateMap` deep-equality guard
 * still halts a loop whose values have settled, but not one that keeps
 * producing changing values.
 */

/**
 * Edge nodes may be namespaced as `<scope>::<key>` to keep scopes distinct; the
 * cycle chain shows only the bare key.
 */
function displayKey(key: string): string {
  const separator = key.indexOf("::");

  return separator === -1 ? key : key.slice(separator + 2);
}

/**
 * Find every dependency cycle in the edge graph. Returns one human-readable
 * chain per cycle (`"a -> b -> a"`, scope prefixes stripped); the validator
 * wraps each chain into a `cycle_detected` issue.
 */
export function findLinkageCycles(edges: Map<string, Set<string>>): string[] {
  const cycles: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(key: string, path: string[]): void {
    if (visiting.has(key)) {
      const startIndex = path.indexOf(key);
      cycles.push(path.slice(startIndex).map(node => displayKey(node)).join(" -> "));
      return;
    }

    if (visited.has(key)) {
      return;
    }

    visiting.add(key);

    const targets = edges.get(key) ?? [];

    for (const target of targets) {
      visit(target, [...path, target]);
    }

    visiting.delete(key);
    visited.add(key);
  }

  for (const key of edges.keys()) {
    visit(key, [key]);
  }

  return cycles;
}
