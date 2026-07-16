import type { EditorPlugins, FormFieldDefinition, PickerProps, PrincipalKind } from "@vef-framework-react/approval-flow-editor";
import type { DeviceRegistries } from "@vef-framework-react/form-editor";
import type { FC, PropsWithChildren, ReactNode } from "react";

import { createApprovalRegistries } from "@vef-framework-react/approval-form-bridge";
import { createContext, use, useMemo, useState } from "react";

/**
 * Host-integration points shared by every approval page and component. Wrap
 * the approval routes in one `ApprovalProvider` and every picker, registry,
 * and renderer below is resolved from it — pages never take these as props.
 */
export interface ApprovalPlugins {
  /**
   * Pickers that resolve concrete ids for each principal kind (user / role /
   * department). The flow designer and the runtime action dialogs (transfer,
   * add assignee, CC) share them. A kind left unset degrades to a plain
   * id-tags input, so the pages stay functional without host wiring.
   */
  pickers?: Partial<Record<PrincipalKind, FC<PickerProps>>>;
  /**
   * Form field registries for rendering and designing approval forms.
   * Defaults to the approval profile from `approval-form-bridge`
   * (`createApprovalRegistries`), which excludes the field types the backend
   * parser rejects.
   */
  registries?: DeviceRegistries;
  /**
   * Host-defined global subjects the flow designer's condition editor offers
   * alongside the built-in applicant attributes — resolved server-side from
   * `Instance.Globals` at instance start.
   */
  globalSubjects?: FormFieldDefinition[];
  /**
   * Renders an instance's opaque business reference as a host-navigable
   * element (a link to the business record, a drawer trigger, …). Defaults to
   * plain text.
   */
  renderBusinessRef?: (businessRef: string) => ReactNode;
}

/**
 * The plugin set after defaulting: registries are always present.
 */
export interface ResolvedApprovalPlugins extends ApprovalPlugins {
  registries: DeviceRegistries;
}

const ApprovalPluginsContext = createContext<ResolvedApprovalPlugins | null>(null);
ApprovalPluginsContext.displayName = "ApprovalPluginsContext";

export interface ApprovalProviderProps extends PropsWithChildren {
  plugins?: ApprovalPlugins;
}

/**
 * Provides the approval plugin set to every page and component beneath it.
 * The default form registries are created once per mount; pass `registries`
 * to override them wholesale.
 */
export function ApprovalProvider({ plugins, children }: ApprovalProviderProps) {
  // Registries are stateful class instances — create the fallback once so the
  // context value cannot churn field registrations across re-renders.
  const [defaultRegistries] = useState(createApprovalRegistries);

  const value = useMemo<ResolvedApprovalPlugins>(
    () => {
      return {
        ...plugins,
        registries: plugins?.registries ?? defaultRegistries
      };
    },
    [plugins, defaultRegistries]
  );

  return <ApprovalPluginsContext value={value}>{children}</ApprovalPluginsContext>;
}

const FALLBACK_PLUGINS: ApprovalPlugins = {};

/**
 * Resolves the approval plugin set. Usable without a provider — every
 * integration point then falls back to its built-in default.
 */
export function useApprovalPlugins(): ResolvedApprovalPlugins {
  const fromContext = use(ApprovalPluginsContext);
  const [defaultRegistries] = useState(createApprovalRegistries);

  return useMemo<ResolvedApprovalPlugins>(
    () => fromContext ?? { ...FALLBACK_PLUGINS, registries: defaultRegistries },
    [fromContext, defaultRegistries]
  );
}

/**
 * Projects the approval plugin set into the flow designer's `EditorPlugins`
 * shape, layering the deploy-derived form fields on top.
 */
export function toEditorPlugins(plugins: ResolvedApprovalPlugins, formFields: FormFieldDefinition[]): EditorPlugins {
  return {
    pickers: plugins.pickers,
    globalSubjects: plugins.globalSubjects,
    formFields
  };
}
