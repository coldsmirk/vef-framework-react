import type { EditorPlugins, FormFieldDefinition, PickerProps, TenantOption } from "@vef-framework-react/approval-flow-editor";
import type { CodeSetDescriptor, DataSourceApi, DataSourceResolver, DeviceRegistries, FormSchema, LinkageEvaluators } from "@vef-framework-react/form-editor";
import type { FC, PropsWithChildren, ReactNode, Ref } from "react";

import type { InstanceDetail, KindOptions, StartForm, ViewerTask, VoidOptions, VoidTarget } from "../types";
import type { FormGlobalDefinition } from "./form-context";

import { createApprovalRegistries } from "@vef-framework-react/approval-form-bridge";
import { createContext, use, useMemo, useState } from "react";

import { VoidRequestDetailView, VoidRequestStartForm } from "../components/void/request-renderer";
import { VOID_REQUEST_KIND } from "../types";

export interface BusinessFormHandle {
  collect: () => Promise<Record<string, unknown>>;
}

export interface BusinessKindRenderer {
  StartForm: FC<{ flow: StartForm; businessRef?: string; handle: Ref<BusinessFormHandle>; voidTarget?: VoidTarget; onAvailabilityChange?: (available: boolean, reason?: string) => void }>;
  VoidOptions?: FC<{ value: VoidOptions; onChange: (value: VoidOptions) => void }>;
  DetailView: FC<{ detail: InstanceDetail; view: unknown; myTask?: ViewerTask; handle: Ref<BusinessFormHandle>; onAvailabilityChange?: (available: boolean, reason?: string) => void }>;
}

/**
 * Host-integration points shared by every approval page and component. Wrap
 * the approval routes in one `ApprovalProvider` and every picker, registry,
 * and renderer below is resolved from it — pages never take these as props.
 */
export interface ApprovalPlugins {
  businessKinds?: Record<string, BusinessKindRenderer>;
  /**
   * Pickers that resolve concrete ids, keyed by kind. The flow designer and
   * the runtime action dialogs (transfer, add assignee, CC) share them.
   *
   * The three built-in slots (`user` / `role` / `department`) cover every kind
   * that selects the same thing: a rule looks up its own kind first and falls
   * back to its selection mode, so a host assignee kind that picks roles needs
   * no picker of its own, while a kind selecting from a host catalog registers
   * one under that kind's name. A kind left unset degrades to a plain id-tags
   * input, so the pages stay functional without host wiring.
   */
  pickers?: Partial<Record<string, FC<PickerProps>>>;
  /**
   * The tenants a shared flow's rules can pick people from. A shared flow is
   * offered to every tenant and routes work to people of other tenants than
   * the one that starts it, so its designer picks a tenant first and then the
   * users or departments of that tenant. Wire the `user` and `department`
   * pickers to list the tenant they are handed (`PickerProps.tenantId`); roles
   * and host catalogs are not per tenant. Without it a shared flow picks
   * people through the plain pickers.
   */
  tenants?: TenantOption[];
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
   * The host globals the backend exposes to approval forms (the host's globals
   * resolver implementing `FormGlobalsExposer`), declared so the form designer
   * offers them as `$globals.<key>` system variables beside the built-in
   * `$applicant` attributes. Keep the keys in lockstep with the resolver's
   * `FormGlobalKeys`, as `globalSubjects` are kept with the keys it resolves:
   * a key exposed there but not declared here still evaluates at runtime yet is
   * not offered, and one declared here but not exposed is offered yet always
   * reads as empty.
   */
  formGlobals?: FormGlobalDefinition[];
  /**
   * Turns a form's remote data-source request into options. Without one, every
   * remote source in an approval form resolves to an empty list — the designer
   * lets you configure the request, but nothing fetches it. Wire the host's
   * API client here; the form designer's preview uses it too.
   */
  dataSourceResolver?: DataSourceResolver;
  /**
   * The host's catalog of option APIs. The form designer's remote data sources
   * then lead with a picker ("部门列表") instead of a hand-typed endpoint and
   * field mapping. A pick is stored as the request itself, so the runtime still
   * fetches through `dataSourceResolver`, which must serve every endpoint
   * listed here.
   */
  dataSourceApis?: DataSourceApi[];
  /**
   * The host's catalog of data dictionaries. The form designer's 数据字典
   * option source then offers a searchable picker instead of a key typed by
   * hand. A pick stores the key alone: forms load their dictionaries through
   * the application's `AppContext.codeSetQueryFn`, which must serve every key
   * listed here.
   */
  codeSets?: CodeSetDescriptor[];
  /**
   * Overrides for expression / script evaluation in form linkage and in
   * data-source parameters bound to the form. Optional: the form runtime falls
   * back to its built-in JavaScript evaluator (`$form` / `$vars` /
   * `$applicant` / `$globals` in scope), so wire this only to swap in a
   * different expression language or sandbox.
   */
  evaluators?: LinkageEvaluators;
  /**
   * Renders an instance's opaque business reference as a host-navigable
   * element (a link to the business record, a drawer trigger, …). Defaults to
   * plain text.
   */
  renderBusinessRef?: (businessRef: string) => ReactNode;
  /**
   * Converts a pinned version's stored form document for runtime forms and
   * annotations. Hosts using Go's `vef.ProvideApprovalFormSchemaParser`
   * can store their own document format. Return a renderer schema unchanged
   * when already native, or undefined for an unsupported document.
   * Pass a stable function reference and leave the input document immutable.
   * The provider caches the result by document identity for all consumers.
   * The built-in flow designer edits its native format and does not use this adapter.
   */
  formSchemaAdapter?: (document: unknown) => FormSchema | undefined;
}

/**
 * The plugin set after defaulting: registries are always present.
 */
export interface ResolvedApprovalPlugins extends ApprovalPlugins {
  registries: DeviceRegistries;
}

export function resolveBusinessRenderer(kinds: ApprovalPlugins["businessKinds"], kind?: string) {
  return kind && kinds && Object.hasOwn(kinds, kind) ? kinds[kind] : undefined;
}

const FALLBACK_PLUGINS: ApprovalPlugins = { businessKinds: { [VOID_REQUEST_KIND]: { StartForm: VoidRequestStartForm, DetailView: VoidRequestDetailView } } };

const ApprovalPluginsContext = createContext<ResolvedApprovalPlugins | null>(null);
ApprovalPluginsContext.displayName = "ApprovalPluginsContext";

const FormSchemaContext = createContext<{
  adapter: NonNullable<ApprovalPlugins["formSchemaAdapter"]>;
  cache: WeakMap<object, FormSchema | undefined>;
} | null>(null);
FormSchemaContext.displayName = "FormSchemaContext";

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
  const adapter = plugins?.formSchemaAdapter;
  const schemas = useMemo(() => adapter ? { adapter, cache: new WeakMap<object, FormSchema | undefined>() } : null, [adapter]);

  const value = useMemo<ResolvedApprovalPlugins>(
    () => {
      return {
        ...plugins,
        businessKinds: { ...FALLBACK_PLUGINS.businessKinds, ...plugins?.businessKinds },
        registries: plugins?.registries ?? defaultRegistries
      };
    },
    [plugins, defaultRegistries]
  );

  return (
    <ApprovalPluginsContext value={value}>
      <FormSchemaContext value={schemas}>{children}</FormSchemaContext>
    </ApprovalPluginsContext>
  );
}

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
 * Resolves a version's form document for rendering without changing cached API data.
 */
export function useFormSchema(document: unknown): FormSchema | undefined {
  const schemas = use(FormSchemaContext);
  return useMemo(() => {
    if (document === undefined || document === null) {
      return;
    }

    if (!schemas) {
      return document as FormSchema;
    }

    const { adapter, cache } = schemas;

    if (typeof document !== "object") {
      return adapter(document);
    }

    if (cache.has(document)) {
      return cache.get(document);
    }

    const resolved = adapter(document);
    cache.set(document, resolved);

    if (typeof resolved === "object" && resolved !== null && resolved !== document) {
      cache.set(resolved, resolved);
    }

    return resolved;
  }, [schemas, document]);
}

/**
 * Projects the approval plugin set into the flow designer's `EditorPlugins`
 * shape, layering the deploy-derived form fields and the application's kind
 * catalog on top.
 *
 * `kindOptions` comes from `approval/flow.list_kind_options`; while it is
 * still loading the editor falls back to the framework built-ins, which is
 * why the designer stays usable before the query resolves.
 */
export function toEditorPlugins(
  plugins: ResolvedApprovalPlugins,
  formFields: FormFieldDefinition[] | undefined,
  kindOptions?: KindOptions
): EditorPlugins {
  return {
    pickers: plugins.pickers,
    tenants: plugins.tenants,
    globalSubjects: plugins.globalSubjects,
    assigneeKinds: kindOptions?.assignees,
    ccKinds: kindOptions?.ccs,
    formFields
  };
}
