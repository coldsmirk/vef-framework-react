import type { UnionToTuple } from "type-fest";
import type { BuildEnvironmentOptions } from "vite";

type ManualChunksOption = NonNullable<
  UnionToTuple<
    NonNullable<NonNullable<BuildEnvironmentOptions["rollupOptions"]>["output"]>
  >[0]["manualChunks"]
>;

const CHUNK_PATTERNS: ReadonlyArray<readonly [string, string]> = [
  ["node_modules/@vef-framework-react/", "vef-framework"],
  ["/packages/", "vef-framework"],
  ["node_modules/lucide-react/", "lucide-icons"],
  ["node_modules/react/", "react"],
  ["node_modules/react-dom/", "react"],
  ["node_modules/scheduler/", "react"],
  ["node_modules/@tanstack/", "tanstack"],
  ["node_modules/pinyin-pro/", "pinyin-vendor"],
  ["node_modules/@pinyin-pro/", "pinyin-vendor"],
  ["node_modules/echarts/", "echarts"]
];

function getChunk(id: string): string | undefined {
  for (const [pattern, chunk] of CHUNK_PATTERNS) {
    if (id.includes(pattern)) {
      return chunk;
    }
  }

  return undefined;
}

export function createChunksConfig(): ManualChunksOption {
  return getChunk;
}
