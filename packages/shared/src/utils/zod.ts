import { z } from "zod";
import { zhCN } from "zod/locales";

z.config(zhCN());

export { z } from "zod";
export type { ZodError, ZodIssue, ZodSchema, ZodType } from "zod";
