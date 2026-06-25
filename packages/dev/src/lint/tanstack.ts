import type { Linter } from "eslint";

import query from "@tanstack/eslint-plugin-query";
import router from "@tanstack/eslint-plugin-router";

/**
 * TanStack Query + Router lint rules (flat recommended). Not part of canon — layered on top for the
 * framework itself and for applications, both of which are built on TanStack. Shared by the dev
 * package's `defineEslintConfig` and the framework's own root config.
 */
export const tanstackConfig = [
  ...query.configs["flat/recommended"],
  ...router.configs["flat/recommended"]
] as Linter.Config[];
