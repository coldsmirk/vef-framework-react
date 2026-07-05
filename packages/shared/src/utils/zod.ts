/* eslint-disable unicorn/no-top-level-side-effects -- This module exports the project-wide configured Zod instance. */
import { z } from "zod";
import { zhCN } from "zod/locales";

z.config(zhCN());

export { z } from "zod";
export type { ZodError, ZodIssue, ZodSchema, ZodType } from "zod";
