import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CodeGenerationValidationError, generateDictionaryKeys } from "./index";

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "vef-code-generation-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

async function writeConfig(content: string): Promise<void> {
  await writeFile(join(projectDir, "code-generation.config.mjs"), content, "utf-8");
}

function createWarnSpy(): { onWarn: (message: string) => void; warnings: string[] } {
  const warnings: string[] = [];
  return {
    onWarn: message => warnings.push(message),
    warnings
  };
}

describe("code-generation/dictionary/generateDictionaryKeys", () => {
  describe("happy path", () => {
    it("writes the generated file and reports the key count", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [
              { key: "sys.menu.type" },
              { key: "sys.user.gender" }
            ]
          }
        };
      `);

      const result = await generateDictionaryKeys({ projectDir });

      expect(result.keyCount).toBe(2);
      expect(result.changed).toBe(true);

      const written = await readFile(result.outputPath, "utf-8");

      expect(written).toContain("\"sys.menu.type\"");
      expect(written).toContain("\"sys.user.gender\"");
    });

    it("reports changed=false on an identical second run", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [{ key: "sys.menu.type" }]
          }
        };
      `);

      await generateDictionaryKeys({ projectDir });
      const second = await generateDictionaryKeys({ projectDir });

      expect(second.changed).toBe(false);
    });

    it("honors output override over config value", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            output: "ignored.gen.ts",
            fetchDictionaryKeys: async () => [{ key: "k" }]
          }
        };
      `);

      const result = await generateDictionaryKeys({
        projectDir,
        output: "custom/path/dict.gen.ts"
      });

      expect(result.outputPath.endsWith("custom/path/dict.gen.ts")).toBe(true);
    });

    it("honors augmentTarget override", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [{ key: "k" }]
          }
        };
      `);

      const result = await generateDictionaryKeys({
        projectDir,
        augmentTarget: "@my-fork/dict"
      });

      const written = await readFile(result.outputPath, "utf-8");

      expect(written).toContain("declare module \"@my-fork/dict\"");
    });
  });

  describe("when check mode is enabled", () => {
    it("does not write the file but still reports changed=true on first run", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [{ key: "sys.menu.type" }]
          }
        };
      `);

      const result = await generateDictionaryKeys({ projectDir, check: true });

      expect(result.changed).toBe(true);
      await expect(readFile(result.outputPath, "utf-8")).rejects.toThrow();
    });

    it("reports changed=false when file is already in sync", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [{ key: "sys.menu.type" }]
          }
        };
      `);

      const initial = await generateDictionaryKeys({ projectDir });
      const baselineStat = await stat(initial.outputPath);
      const baselineMtime = baselineStat.mtimeMs;

      const check = await generateDictionaryKeys({ projectDir, check: true });
      const afterStat = await stat(initial.outputPath);

      expect(check.changed).toBe(false);
      expect(afterStat.mtimeMs).toBe(baselineMtime);
    });
  });

  describe("dedupe and sort", () => {
    it("dedupes duplicate keys and sorts by code point", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [
              { key: "z.last" },
              { key: "a.first" },
              { key: "a.first" }
            ]
          }
        };
      `);

      const result = await generateDictionaryKeys({ projectDir });

      expect(result.keyCount).toBe(2);

      const written = await readFile(result.outputPath, "utf-8");

      expect(written.indexOf("\"a.first\"")).toBeLessThan(written.indexOf("\"z.last\""));
    });

    it("warns when duplicate keys have conflicting comments", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [
              { key: "k", comment: "first" },
              { key: "k", comment: "second" }
            ]
          }
        };
      `);

      const { onWarn, warnings } = createWarnSpy();

      await generateDictionaryKeys({ projectDir, onWarn });

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("Duplicate dictionary key \"k\" with conflicting comments");
    });

    it("does not warn when duplicate keys have identical comments", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [
              { key: "k", comment: "same" },
              { key: "k", comment: "same" }
            ]
          }
        };
      `);

      const { onWarn, warnings } = createWarnSpy();

      await generateDictionaryKeys({ projectDir, onWarn });

      expect(warnings).toHaveLength(0);
    });

    it("does not warn when duplicate keys both omit the comment", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [
              { key: "k" },
              { key: "k" }
            ]
          }
        };
      `);

      const { onWarn, warnings } = createWarnSpy();

      await generateDictionaryKeys({ projectDir, onWarn });

      expect(warnings).toHaveLength(0);
    });
  });

  describe("when fetcher returns no entries", () => {
    it("warns and generates DictionaryKey = never", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => []
          }
        };
      `);

      const { onWarn, warnings } = createWarnSpy();
      const result = await generateDictionaryKeys({ projectDir, onWarn });

      expect(result.keyCount).toBe(0);
      expect(warnings[0]).toContain("returned no entries");

      const written = await readFile(result.outputPath, "utf-8");

      expect(written).toContain("export type DictionaryKey = never;");
    });
  });

  describe("key charset validation", () => {
    it("rejects keys containing characters outside [A-Za-z0-9_.-]", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [{ key: "bad key with spaces" }]
          }
        };
      `);

      await expect(generateDictionaryKeys({ projectDir }))
        .rejects
        .toThrow(CodeGenerationValidationError);
    });

    it("rejects keys with quote injection attempts", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [{ key: \`evil"; import("x"); //\` }]
          }
        };
      `);

      await expect(generateDictionaryKeys({ projectDir }))
        .rejects
        .toThrow(CodeGenerationValidationError);
    });
  });

  describe("output path safety", () => {
    it("rejects absolute output paths", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [{ key: "k" }]
          }
        };
      `);

      await expect(
        generateDictionaryKeys({ projectDir, output: "/tmp/escape.gen.ts" })
      ).rejects.toThrow(CodeGenerationValidationError);
    });

    it("rejects output paths escaping the project root via ..", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [{ key: "k" }]
          }
        };
      `);

      await expect(
        generateDictionaryKeys({ projectDir, output: "../escape.gen.ts" })
      ).rejects.toThrow(CodeGenerationValidationError);
    });

    it("refuses to overwrite a symlink", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => [{ key: "k" }]
          }
        };
      `);

      const decoyTarget = join(projectDir, "decoy-target.txt");
      await writeFile(decoyTarget, "decoy", "utf-8");

      const symlinkPath = join(projectDir, "dict.gen.ts");
      await symlink(decoyTarget, symlinkPath);

      await expect(
        generateDictionaryKeys({ projectDir, output: "dict.gen.ts" })
      ).rejects.toThrow(CodeGenerationValidationError);

      expect(await readFile(decoyTarget, "utf-8")).toBe("decoy");
    });
  });

  describe("fetcher timeout", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("aborts when the fetcher exceeds the configured timeout", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      await writeConfig(`
        export default {
          dictionaryKeys: {
            timeout: 50,
            fetchDictionaryKeys: () => new Promise(() => {})
          }
        };
      `);

      const pending = generateDictionaryKeys({ projectDir });
      const assertion = expect(pending).rejects.toThrow(/timed out after 50ms/);

      await vi.advanceTimersByTimeAsync(60);
      await assertion;
    });

    it("does not time out when timeout is 0", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            timeout: 0,
            fetchDictionaryKeys: () => Promise.resolve([{ key: "k" }])
          }
        };
      `);

      const result = await generateDictionaryKeys({ projectDir });

      expect(result.keyCount).toBe(1);
    });
  });

  describe("config loading errors", () => {
    it("throws ValidationError when no config file exists", async () => {
      await expect(generateDictionaryKeys({ projectDir }))
        .rejects
        .toThrow(CodeGenerationValidationError);
    });

    it("throws ValidationError when the config has no dictionaryKeys block", async () => {
      await writeConfig("export default {};");

      await expect(generateDictionaryKeys({ projectDir }))
        .rejects
        .toThrow(/no `dictionaryKeys` block/);
    });

    it("throws ValidationError when dictionaryKeys.fetchDictionaryKeys is missing", async () => {
      await writeConfig("export default { dictionaryKeys: {} };");

      await expect(generateDictionaryKeys({ projectDir }))
        .rejects
        .toThrow(/`dictionaryKeys\.fetchDictionaryKeys` must be a function/);
    });

    it("rejects --config paths that escape the project root", async () => {
      await expect(
        generateDictionaryKeys({ projectDir, configFile: "../etc/passwd" })
      ).rejects.toThrow(CodeGenerationValidationError);
    });

    it("rejects non-string output in dictionaryKeys config", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            output: 123,
            fetchDictionaryKeys: async () => [{ key: "k" }]
          }
        };
      `);

      await expect(generateDictionaryKeys({ projectDir }))
        .rejects
        .toThrow(/`dictionaryKeys\.output` must be a string/);
    });

    it("rejects negative timeout in dictionaryKeys config", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            timeout: -1,
            fetchDictionaryKeys: async () => [{ key: "k" }]
          }
        };
      `);

      await expect(generateDictionaryKeys({ projectDir }))
        .rejects
        .toThrow(/`dictionaryKeys\.timeout` must be a finite non-negative number/);
    });

    it("rejects string timeout in dictionaryKeys config", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            timeout: "30s",
            fetchDictionaryKeys: async () => [{ key: "k" }]
          }
        };
      `);

      await expect(generateDictionaryKeys({ projectDir }))
        .rejects
        .toThrow(/`dictionaryKeys\.timeout` must be a finite non-negative number/);
    });

    it("propagates fetcher errors", async () => {
      await writeConfig(`
        export default {
          dictionaryKeys: {
            fetchDictionaryKeys: async () => { throw new Error("backend down"); }
          }
        };
      `);

      await expect(generateDictionaryKeys({ projectDir }))
        .rejects
        .toThrow(/backend down/);
    });
  });
});
