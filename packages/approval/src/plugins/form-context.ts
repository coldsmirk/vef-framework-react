import type { EvaluationContext, LinkageContextSource } from "@vef-framework-react/form-editor";

import type { UserInfo } from "../types";

/**
 * A host global an approval form may read, declared so the form designer can
 * offer it. The value itself comes from the backend: the host's
 * `InstanceGlobalsResolver` produces it and its `FormGlobalsExposer` names it,
 * which is what ships it to the form as `$globals.<key>`.
 */
export interface FormGlobalDefinition {
  /**
   * The global's key, exactly as the resolver produces it.
   */
  key: string;
  /**
   * Display name in the designer, e.g. `"发起人职称"`.
   */
  label: string;
}

/**
 * The applicant attributes every approval form can read as `$applicant`: the
 * fields of the instance's applicant snapshot.
 */
const APPLICANT_CONTEXT_SOURCES: readonly LinkageContextSource[] = [
  { key: "$applicant.id", label: "发起人 ID" },
  { key: "$applicant.name", label: "发起人姓名" },
  { key: "$applicant.departmentId", label: "发起人部门 ID" },
  { key: "$applicant.departmentName", label: "发起人部门" }
];

/**
 * The system variables the approval form designer offers: the built-in
 * applicant attributes, then the host's declared form globals.
 */
export function toFormContextSources(formGlobals: readonly FormGlobalDefinition[] | undefined): LinkageContextSource[] {
  return [
    ...APPLICANT_CONTEXT_SOURCES,
    ...(formGlobals ?? []).map(global => {
      return { key: `$globals.${global.key}`, label: global.label };
    })
  ];
}

/**
 * The evaluation context an approval form runs under: the instance's applicant
 * as `$applicant` and its form-visible globals as `$globals`. Never `$user`:
 * the form is evaluated for every participant, and a rule about the initiator
 * must read the same initiator for each of them.
 */
export function toFormEvaluationContext(
  applicant: UserInfo | undefined,
  globals: Record<string, unknown> | undefined
): EvaluationContext {
  return {
    ...applicant !== undefined && { applicant: { ...applicant } },
    ...globals !== undefined && { globals }
  };
}
