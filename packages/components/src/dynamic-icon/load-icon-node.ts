import type { IconNode } from "lucide-react";

import type { DynamicIconName } from "./props";

import { lucideDynamicIconImports } from "@lucide/icons/dynamic";

/**
 * Module-global cache of resolved lucide icon nodes, shared across every
 * `DynamicIcon`. A name resolved once renders synchronously for the app's
 * lifetime — including remounts inside a virtualized grid.
 */
const cache = new Map<DynamicIconName, IconNode>();

/**
 * In-flight imports, deduped by name, so many cells requesting the same icon at
 * once share a single chunk request.
 */
const inFlight = new Map<DynamicIconName, Promise<IconNode | null>>();

/**
 * lucide ships one lazily-imported chunk per icon, so rendering a large grid —
 * or scrolling the full ~2000-icon set — would otherwise fire thousands of
 * parallel `import()` requests and thrash the bundler / dev server (the
 * documented "504s on first paint" hazard). Cap the simultaneous imports and
 * queue the rest; virtualization bounds what is mounted, this bounds what loads.
 */
const MAX_CONCURRENT_IMPORTS = 6;
let activeImports = 0;
const importQueue: Array<() => void> = [];

function drainQueue(): void {
  while (activeImports < MAX_CONCURRENT_IMPORTS && importQueue.length > 0) {
    const run = importQueue.shift()!;
    activeImports += 1;
    run();
  }
}

/**
 * The already-resolved node for `name`, or `undefined` if it has not loaded yet.
 * Lets a consumer seed synchronous state on mount so cached icons never flash.
 */
export function getCachedIconNode(name: DynamicIconName): IconNode | undefined {
  return cache.get(name);
}

/**
 * Resolve an icon's node, loading its chunk on demand. Cached names resolve
 * synchronously, concurrent requests for the same name share one import, and the
 * underlying `import()` calls are throttled to {@link MAX_CONCURRENT_IMPORTS}.
 * Resolves to `null` when the chunk fails to load.
 */
export function loadIconNode(name: DynamicIconName): Promise<IconNode | null> {
  const cached = cache.get(name);

  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = inFlight.get(name);

  if (pending) {
    return pending;
  }

  const promise = new Promise<IconNode | null>(resolve => {
    importQueue.push(() => {
      lucideDynamicIconImports[name]()
        .then(({ default: iconData }) => {
          const node = iconData.node as IconNode;
          cache.set(name, node);
          resolve(node);
        })
        .catch(() => resolve(null))
        .finally(() => {
          activeImports -= 1;
          inFlight.delete(name);
          drainQueue();
        });
    });

    drainQueue();
  });

  inFlight.set(name, promise);

  return promise;
}
