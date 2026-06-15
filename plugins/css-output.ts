import type { Plugin } from "vite";

/**
 * Renames CSS-related chunks from long `node_modules/...` paths to shorter `_internal/...` paths.
 *
 * Compatible with both Rollup and Rolldown (Vite 8+):
 * - Mutates `chunk.fileName` and `chunk.code` directly (supported by Rolldown's chunk proxy)
 * - Uses `delete bundle[oldName]` (supported by Rolldown's bundle proxy)
 * - Avoids `bundle[newName] = chunk` (rejected by Rolldown's bundle proxy)
 */
export default function cssOutputPlugin(): Plugin {
  return {
    name: "@vef-framework-react/css-output",
    generateBundle(_, bundle) {
      // Phase 1: Collect renames
      const renames = new Map<string, string>();

      for (const fileName of Object.keys(bundle)) {
        if (!fileName.includes("node_modules/")) {
          continue;
        }

        const chunk = bundle[fileName];

        if (!chunk) {
          continue;
        }

        const isCss = fileName.includes(".css.js") || fileName.includes(".css.cjs");
        const ext = fileName.endsWith(".cjs") ? ".cjs" : ".js";

        let newFileName: string;

        if (isCss) {
          const baseName = fileName.split("/").pop()?.replace(/\.(?:js|cjs)$/, "").replace(/\.css$/, "") || "index";
          newFileName = `_internal/${baseName}${ext}`;
        } else {
          const packageMatch = fileName.match(/node_modules\/(?:@[^/]+\/[^/]+|[^/]+)/);

          if (!packageMatch) {
            continue;
          }

          const packageName = packageMatch[0].replace("node_modules/", "").replaceAll(/[@/]/g, "_");
          const baseName = fileName.split("/").pop()?.replace(/\.(?:js|cjs)$/, "") || "index";
          newFileName = `_internal/${packageName}/${baseName}${ext}`;
        }

        renames.set(fileName, newFileName);
      }

      if (renames.size === 0) {
        return;
      }

      // Phase 2: Update import paths in all chunks, then rename
      for (const [, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "chunk" || !chunk.code) {
          continue;
        }

        let { code } = chunk;
        const currentDir = chunk.fileName.split("/").slice(0, -1);

        for (const [oldPath, newPath] of renames) {
          const relativePath = computeRelativePath(currentDir, newPath);
          const escaped = oldPath.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

          code = code
            .replaceAll(new RegExp(String.raw`(from\s+['"])([^'"]*${escaped})(['"])`, "g"), `$1${relativePath}$3`)
            .replaceAll(new RegExp(String.raw`(require\s*\(\s*['"])([^'"]*${escaped})(['"]\s*\))`, "g"), `$1${relativePath}$3`);
        }

        if (code !== chunk.code) {
          chunk.code = code;
        }
      }

      // Phase 3: Rename files by mutating chunk.fileName + deleting old bundle key
      for (const [oldName, newName] of renames) {
        const chunk = bundle[oldName];

        if (chunk) {
          chunk.fileName = newName;
          delete bundle[oldName];
        }
      }
    }
  };
}

function computeRelativePath(fromDirParts: string[], toPath: string): string {
  const toDirParts = toPath.split("/").slice(0, -1);
  const toFile = toPath.split("/").pop()!;

  let common = 0;

  for (let i = 0; i < Math.min(fromDirParts.length, toDirParts.length); i++) {
    if (fromDirParts[i] === toDirParts[i]) {
      common++;
    } else {
      break;
    }
  }

  const up = fromDirParts.length - common;
  const down = toDirParts.slice(common);

  let rel = up > 0 ? "../".repeat(up) : "./";

  if (down.length > 0) {
    rel += `${down.join("/")}/`;
  }

  return rel + toFile;
}
