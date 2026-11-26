import type { FormEditorProps } from "@vef-framework-react/form-editor";
import type { ReactElement } from "react";

import { validateApprovalProjection } from "@vef-framework-react/approval-form-bridge";
import { FormEditor } from "@vef-framework-react/form-editor";
import { useMemo } from "react";

import { useApprovalPlugins } from "../../plugins";
import { toFormContextSources } from "../../plugins/form-context";

/**
 * `FormEditor`'s props, less the two the approval contract fixes: the system
 * variables an approval form may read, and the projection check the backend
 * parser applies at deploy.
 */
export type ApprovalFormEditorProps = Omit<FormEditorProps, "contextSources" | "validate">;

/**
 * The approval form designer: `FormEditor` wired from `ApprovalProvider`, as
 * `InstanceFormPanel` wires the runtime `FormRenderer`. It offers the
 * applicant attributes and the declared `formGlobals` as system variables and
 * reports the approval projection's contract issues beside the editor's own.
 * Registries, services, evaluators and the API and dictionary catalogs come
 * from the provider; a prop passed explicitly wins, such as the designer's
 * own registries instance or a catalog loaded at runtime.
 */
export function ApprovalFormEditor({
  codeSets,
  dataSourceApis,
  evaluators,
  registries,
  services,
  ...props
}: ApprovalFormEditorProps): ReactElement {
  const plugins = useApprovalPlugins();
  const contextSources = useMemo(() => toFormContextSources(plugins.formGlobals), [plugins.formGlobals]);

  return (
    <FormEditor
      {...props}
      codeSets={codeSets ?? plugins.codeSets}
      contextSources={contextSources}
      dataSourceApis={dataSourceApis ?? plugins.dataSourceApis}
      evaluators={evaluators ?? plugins.evaluators}
      registries={registries ?? plugins.registries}
      services={services ?? plugins.services}
      validate={validateApprovalProjection}
    />
  );
}
