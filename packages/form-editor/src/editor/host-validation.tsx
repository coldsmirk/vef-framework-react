import type { ReactElement, ReactNode } from "react";

import type { SchemaIssue } from "../engine/validation";
import type { FormSchema } from "../types";

import { createContext, use } from "react";

/**
 * A host's own checks of a schema, layered over the editor's structural
 * validation — a downstream contract the editor cannot know about, such as an
 * approval backend that rejects some field types. It receives only schemas
 * the structural pass found free of errors, so it may assume a well-formed
 * tree, and returns host-specific issues only (the structural ones are the
 * editor's).
 */
export type SchemaValidator = (schema: FormSchema) => readonly SchemaIssue[];

const HostValidationContext = createContext<SchemaValidator | undefined>(undefined);
HostValidationContext.displayName = "HostValidationContext";

export function HostValidationProvider({
  children,
  validate
}: {
  children: ReactNode;
  validate: SchemaValidator | undefined;
}): ReactElement {
  return <HostValidationContext value={validate}>{children}</HostValidationContext>;
}

/**
 * The host's validator, or `undefined` when it supplies none.
 */
export function useHostValidation(): SchemaValidator | undefined {
  return use(HostValidationContext);
}
