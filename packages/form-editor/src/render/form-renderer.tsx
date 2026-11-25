import type { ComponentPropsWithoutRef, ReactElement, ReactNode, Ref, RefObject } from "react";

import type { RuntimeFieldState } from "../engine/linkage";
import type {
  EffectSinks,
  KnownOptionsLookup,
  RefreshDataSource,
  ResetForm,
  RunSequences,
  SequenceEnv,
  SetVariable,
  SubmitForm
} from "../runtime/effects";
import type { RuntimeForm, RuntimeFormValues } from "../runtime/types";
import type {
  Block,
  ChromeTabItem,
  CodeSetQueryFn,
  EvaluationContext,
  FieldLinkageRule,
  FieldPermission,
  FixedSubformRows,
  FlexNode,
  FormField,
  FormSchema,
  FormServices,
  GapScale,
  GridNode,
  KeyedFormField,
  LinkageEvaluators,
  LinkageTriggerKind,
  PresentationDevice,
  RuntimeSchema,
  SectionNode,
  SubformNode,
  TabsNode
} from "../types";

import { css } from "@emotion/react";
import { Flex, globalCssVars, Stack, useForm, useFormStore } from "@vef-framework-react/components";
import { isDeepEqual } from "@vef-framework-react/shared";
import { createContext, memo, use, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";

import { MobileScope } from "../components/mobile/scope";
import { collectCodeSets } from "../engine/code-sets";
import { schemaHasBoundParams } from "../engine/data-source-params";
import { isKeyedField } from "../engine/keys";
import {
  deriveDefaultValues,
  deriveEvaluationVariables,
  getFieldEventTriggerKinds,
  getFieldPermission,
  getLinkageSourceKeys,
  getTriggerEffectSequences,
  isWritableFieldPermission,
  resolveLinkageEvaluators
} from "../engine/linkage";
import { toRuntimeSchema } from "../engine/schema/presentation";
import {
  dynamicAddRowLabel,
  fixedRowItemLabel,
  getDynamicSubformRows,
  isFixedSubform,
  isTableColumnField
} from "../engine/schema/subform";
import { EditorIcon } from "../icons";
import { dispatchFormSequences, SequenceControllerProvider, useEffectDispatch } from "../runtime/effects";
import { RecordSelectorController, RecordSelectorHost } from "../runtime/record-selector";
import { resolveScopeValues } from "../runtime/resolve-scope-values";
import { useRuntimeFieldState } from "../runtime/runtime-context";
import { RuntimeStateController, SubformRowController } from "../runtime/runtime-state-controller";
import { SequenceController } from "../runtime/sequence-controller";
import { DeviceProvider, useContainerChrome, useDevice, useFieldRegistry } from "../store/engine-provider";
import { CodeSetProvider } from "./code-set-context";
import { DataSourceProvider, useKnownOptionsLookup } from "./data-source-context";
import { FLEX_ALIGN_MAP, FLEX_JUSTIFY_MAP, flexSlotStyle } from "./flex-style";
import { FormFieldRenderer } from "./form-field";
import { gridCellStyle, gridColumnCount, gridContainerStyle } from "./grid-style";
import { FieldCellProvider } from "./parts/field-shell";
import { DEFAULT_STACK_GAP, resolveStackGap, stackSlotStyle } from "./stack-style";
import {
  fixedHeaderColumnStyle,
  subformRowHeading,
  SubformTableFrame,
  tableCellExtraCss,
  tableColumnHeaderId,
  tableColumnStyle,
  tableDataCellCss,
  tableFixedHeaderCellCss,
  tableRemoveCellCss,
  tableRowHeadingCss
} from "./subform-table";
import {
  blankSubformRow,
  buildRuntimeFormId,
  collectSubmitErrors,
  filterSubmitValues,
  isRuntimeRequired,
  validateRuntimeField
} from "./submit";
import { deriveFixedRowKeys, FixedSubformStatusBanner, useFixedSubformRows } from "./use-fixed-subform-rows";

const rootCss = css({ width: "100%" });

export interface FormRendererProps {
  schema: FormSchema;
  /**
   * Which device's presentation to render. Defaults to `"pc"`. When that device
   * has no design yet (an undesigned mobile), an empty state is shown rather than
   * falling back to the other device.
   */
  device?: PresentationDevice;
  defaultValues?: RuntimeFormValues;
  disabled?: boolean;
  /**
   * Server-resolved per-field interactivity clamp (see {@link FieldPermission}),
   * keyed by the field's data-binding `key`. The clamp is the OUTER bound —
   * linkage may narrow further but never widen past it: `"hidden"` unmounts the
   * field and drops its value from the submit payload, `"visible"` renders it
   * read-only (excluded from payload and validation), `"required"` forces the
   * empty-value check even without a static `validate.required`, and
   * `"editable"` changes nothing. An absent prop OR an absent key means no
   * clamp for that field — the renderer stays fully generic; hosts that want a
   * default-deny posture materialize the full map server-side. Keys address
   * root-scope keyed nodes only: a keyed subform is clamped whole (its template
   * fields are never addressed individually).
   */
  fieldPermissions?: Record<string, FieldPermission>;
  /**
   * Overrides for the dynamic linkage evaluators. Expression and script slots
   * fall back to plain-JavaScript `new Function` compilation. Host projects
   * only need overrides for a sandbox, a custom expression engine, or a DSL.
   */
  evaluators?: LinkageEvaluators;
  /**
   * Host-injected runtime services (`request`, `navigate`, `notify`). `request`
   * backs both remote option sources and `api_call` actions; `notify` defaults
   * to the framework message helpers when omitted.
   */
  services?: FormServices;
  /**
   * Loads the data dictionaries `codeSet` option sources read — every one the
   * form references, in one call. Defaults to the application's
   * `AppContext.codeSetQueryFn`; without either, a `codeSet` source has no
   * options.
   */
  codeSetQueryFn?: CodeSetQueryFn;
  /**
   * Host-supplied evaluation scope. `$vars` here merges over (and overrides) the
   * schema's variable defaults; `$user` / `$node` / `$applicant` / `$globals`
   * carry runtime context. The form derives `$vars` from `schema.variables` on
   * its own, so this is only needed to supply host context or override a
   * variable at runtime.
   */
  evaluationContext?: EvaluationContext;
  onSubmit?: (values: RuntimeFormValues) => void | Promise<void>;
  /**
   * Imperative handle for host chrome (a Modal footer's 确定/取消, an external
   * save button): submit / reset / read the live values without a schema
   * button. The schema's own `submit` buttons keep working either way.
   */
  apiRef?: Ref<FormRendererApi>;
  /**
   * Pen mobile picker overlays (masks + sheets) to this renderer's box instead
   * of the browser viewport. Only meaningful when `device === "mobile"`, and
   * intended for a desktop "picture-in-picture" preview where the form is shown
   * inside a phone-sized frame (the form editor's own preview). Defaults to
   * `false`: at real mobile runtime the viewport is the phone screen, so the
   * native viewport-anchored overlay behavior is correct.
   */
  containOverlays?: boolean;
  /**
   * Content beside a visible keyed field. A subform is addressed once by its key.
   * Both layouts expose row headings and cells with a zero-based row. Desktop tables
   * also expose column headers. All use the subform key and optional column key.
   */
  renderFieldExtra?: (field: { key: string; type: Block["type"]; label?: string; row?: number; column?: string }) => ReactNode;
}

/**
 * The curated imperative surface of a rendered form. `submit` runs the same
 * pending-request wait + validation + `beforeSubmit` + `onSubmit` pipeline as
 * a schema submit button.
 */
export interface FormRendererApi {
  submit: () => Promise<void>;
  reset: () => void;
  /**
   * Wait for every in-flight effect sequence holding a pending request to
   * finish writing before reading values synchronously (e.g. an external
   * action that bypasses validation and reads {@link getSubmitValues} directly).
   */
  waitForPendingSequences: () => Promise<void>;
  /**
   * The RAW live form state — including hidden fields' seeded defaults and
   * read-only (non-writable-clamped) values. For the payload the submit
   * pipeline would actually deliver, use {@link getSubmitValues}.
   */
  getValues: () => RuntimeFormValues;
  /**
   * Exactly what the submit pipeline would deliver to `onSubmit` right now:
   * the live values run through the same payload filtering (effectively-hidden
   * fields dropped, non-writable-clamped keys excluded, subforms recursed per
   * row) — without running validation, awaiting pending sequences, or running
   * the submit lifecycle.
   */
  getSubmitValues: () => RuntimeFormValues;
}

type RuntimeFormApi = ReturnType<typeof useRuntimeForm>;

/**
 * TanStack Form's `<AppField>` render-prop gives us a fully typed `fieldApi`
 * via callback inference; we widen it here to a structural surface so the cell
 * renderer doesn't need to thread a dozen generics. Everything we call is a
 * stable part of TanStack Form's documented API.
 */
interface RuntimeFieldApi {
  handleChange: (updater: unknown) => void;
  form: { state: { values: RuntimeFormValues } };
  state: { meta: { errors: unknown[] }; value: unknown };
}

/**
 * Reactive evaluation scope for the runtime-state controllers (root + per-row),
 * which must re-evaluate when `$vars` change. Field cells deliberately do NOT
 * read this — they read live values through {@link RenderCtx.env} so a variable
 * change never busts their memo and re-renders the whole tree.
 */
const EvaluationScopeContext = createContext<EvaluationContext | undefined>(undefined);
EvaluationScopeContext.displayName = "EvaluationScopeContext";

interface FormSurfaceGate {
  onSubmit: () => Promise<void>;
  onReset: () => void;
}

const FormSurfaceGateContext = createContext<FormSurfaceGate | null>(null);
FormSurfaceGateContext.displayName = "FormSurfaceGateContext";

/**
 * Polymorphic `<form>` surface passed to `@vef-framework-react/components`
 * `<Form component={FormSurface}>`. Because `component` is not the `"form"`
 * intrinsic string, `Form` skips injecting its default `handleSubmit` / `reset`
 * listeners and lets native submit/reset events route directly through our
 * unified submit/reset gate without monkey-patching the TanStack Form instance.
 */
function FormSurface(props: ComponentPropsWithoutRef<"form">): ReactElement {
  const gate = use(FormSurfaceGateContext);

  return (
    <form
      {...props}
      onReset={event => {
        event.preventDefault();
        gate?.onReset();
      }}
      onSubmit={event => {
        event.preventDefault();
        // Contain rejections from host `onSubmit` handlers: a native form
        // submission has no awaiting caller.
        gate?.onSubmit().catch((error: unknown) => {
          console.error("[FormRenderer] submit failed:", error);
        });
      }}
    />
  );
}

interface RenderCtx {
  renderFieldExtra?: FormRendererProps["renderFieldExtra"];
  rowLocation?: { key: string; row: number };
  /**
   * Whether the schema binds any data-source parameter to the form. Threaded
   * down so each subform row's controller publishes its own parameter scope —
   * a bound parameter inside a repeated row must resolve against THAT row.
   */
  boundParams: boolean;
  disabled: boolean;
  /**
   * Renderer-instance prefix (React `useId`) for every field's DOM id. Two
   * renderers of the same schema can legitimately share a page (a host
   * mounting form + preview, the editor's preview beside its kept-alive JSON
   * view), and without this the `field-${field.id}` ids would collide —
   * cross-wiring every label's `htmlFor` across the instances.
   */
  domIdPrefix: string;
  /**
   * Stable, live-reading sequence environment shared across root scope,
   * subform rows, and form lifecycle hooks. Keeps `RenderCtx` identity immune
   * to `$vars` / `services` churn while every step reads current values.
   */
  env: SequenceEnv;
  evaluators: LinkageEvaluators | undefined;
  /**
   * Server-resolved permission clamp for the CURRENT value scope's keys. The
   * root ctx carries the host map; a subform row's ctx nulls it out (see
   * {@link SubformRowBase}) — template fields are never clamped individually.
   * Read by the live field validators, which must agree with the rendered
   * (clamped) runtime state.
   */
  fieldPermissions: Record<string, FieldPermission> | undefined;
  form: RuntimeFormApi;
  /**
   * The form-level stack gap in pixels (from the schema's `gap`), used as the
   * gap a container body inherits when it sets no `gap`, and as the default gap
   * for flex / grid containers.
   */
  gutter: number;
  /**
   * Host-supplied `defaultValues` before schema seeding, used by fixed-row
   * subforms to distinguish stored records (non-empty array → lock, never
   * re-resolve) from a fresh fill (empty / absent → resolve source).
   */
  initialValues: RuntimeFormValues | undefined;
  /**
   * Field-name prefix for the current value scope, e.g. `"lines[0]."`.
   */
  namePrefix: string;
}

const FORM_LIFECYCLE_SCOPE_ID = "__form_lifecycle__";

function KnownOptionsBridge({ lookupRef }: { lookupRef: RefObject<KnownOptionsLookup> }): null {
  const lookup = useKnownOptionsLookup();

  lookupRef.current = lookup;

  return null;
}

/**
 * Structural view of a TanStack Form array field's api (method bivariance).
 */
interface RuntimeArrayFieldApi {
  state: { value: unknown[] };
  pushValue: (value: unknown) => void;
  removeValue: (index: number) => void;
}

function useRuntimeForm(args: {
  activeSubmitGenerationRef: RefObject<number | null>;
  defaultValues: RuntimeFormValues | undefined;
  envRef: RefObject<SequenceEnv | null>;
  onSubmitRef: RefObject<FormRendererProps["onSubmit"]>;
  resetGenerationRef: RefObject<number>;
  runtimeSchema: RuntimeSchema;
  runtimeSchemaRef: RefObject<RuntimeSchema>;
}) {
  const defaultValues = useMemo(
    () => deriveDefaultValues(args.runtimeSchema, args.defaultValues),
    [args.runtimeSchema, args.defaultValues]
  );
  const formId = useMemo(() => buildRuntimeFormId(args.runtimeSchema), [args.runtimeSchema]);

  return useForm({
    formId,
    defaultValues,
    // The schema-driven submit gate (`validators.onSubmit` below) writes errors
    // into fields that may never mount, and those errors can become stale when
    // linkage later hides the field — nothing re-validates an unmounted field.
    // TanStack's default `canSubmit` gate would then dead-lock the form (it
    // bails BEFORE any validator re-runs). Letting the attempt through means
    // every submit re-runs the full validation pipeline, which recomputes (and
    // clears) the schema-driven errors; actual invalidity still blocks at the
    // post-validation gates. Nothing in the runtime consumes `state.canSubmit`.
    canSubmitWhenInvalid: true,
    validators: {
      // Submit-time validation must be schema-driven, not mount-driven: antd
      // Tabs / Collapse mount panes lazily, so a required field in a
      // never-activated pane has no mounted field validator. This form-level
      // pass runs the same checks over every keyed field (root + subform rows)
      // and maps failures into TanStack's per-field `fields` error channel —
      // blocking submission now and surfacing on the field when its pane is
      // visited. See `collectSubmitErrors` for the two-layer design.
      onSubmit: ({ value }) => {
        const env = args.envRef.current;
        const fields = collectSubmitErrors({
          blocks: args.runtimeSchemaRef.current.children,
          disabled: env?.getDisabled() ?? false,
          evaluators: env?.getEvaluators(),
          evaluationContext: env?.getEvaluationContext(),
          fieldPermissions: env?.getFieldPermissions(),
          namePrefix: "",
          values: value
        });

        return Object.keys(fields).length > 0 ? { fields } : undefined;
      }
    },
    onSubmit: async ({ value }) => {
      // Guard every phase of `handleSubmit` against a reset fired during
      // validation ticks or between lifecycle hooks.
      const submitGeneration = args.activeSubmitGenerationRef.current ?? args.resetGenerationRef.current;
      const wasReset = (): boolean => args.resetGenerationRef.current !== submitGeneration;

      if (wasReset()) {
        return;
      }

      const schema = args.runtimeSchemaRef.current;
      const formRules = schema.linkage?.rules;
      const env = args.envRef.current;

      // Form-scope lifecycle sequences bracket submission: `beforeSubmit`
      // completes before the host handler and only `"completed"` allows the
      // host `onSubmit` to run (aborted / stopped / failed sequences block
      // quietly without throwing); `afterSubmit` runs only after the handler
      // resolves.
      if (env !== null) {
        const beforeOutcome = await dispatchFormSequences({
          env,
          schema,
          scopeId: FORM_LIFECYCLE_SCOPE_ID,
          sequences: getTriggerEffectSequences(formRules, "beforeSubmit"),
          stopOnIncomplete: true
        });

        if (beforeOutcome !== "completed" || wasReset()) {
          return;
        }
      }

      // Read the values AFTER the beforeSubmit sequences, not the snapshot
      // form-core captured for validation: `writeFieldValue` allocates a new
      // values object, so a `set_fields` at this trigger would otherwise land
      // in the UI and never on the wire — and `getSubmitValues`, which reads
      // the store live, would disagree with the pipeline it documents itself
      // as mirroring. `value` stays the validation snapshot, which is correct:
      // validation genuinely runs before these sequences.
      const submitted = env?.form.store.state.values ?? value;

      await args.onSubmitRef.current?.(filterSubmitValues({
        blocks: schema.children,
        evaluators: env?.getEvaluators(),
        evaluationContext: env?.getEvaluationContext(),
        fieldPermissions: env?.getFieldPermissions(),
        values: submitted
      }));

      if (env !== null && !wasReset()) {
        await dispatchFormSequences({
          env,
          schema,
          scopeId: FORM_LIFECYCLE_SCOPE_ID,
          sequences: getTriggerEffectSequences(formRules, "afterSubmit"),
          stopOnIncomplete: false
        });
      }
    }
  });
}

/**
 * Runtime renderer for a form schema.
 *
 * Resolves the requested device's design into a {@link RuntimeSchema} (an
 * undesigned device shows an empty state) and provides the device to the field
 * registry. The inner component owns the actual runtime form state.
 */
export function FormRenderer({
  containOverlays = false,
  device = "pc",
  schema,
  ...rest
}: FormRendererProps): ReactElement {
  // Stable across renders: the inner form derives default values, the form id,
  // and `$vars` seed from this, so a fresh reference each render would re-seed
  // `$vars` and clobber `set_variable` writes on any host re-render.
  const runtimeSchema = useMemo(() => toRuntimeSchema(schema, device), [schema, device]);
  const content = runtimeSchema
    ? <FormRendererInner runtimeSchema={runtimeSchema} {...rest} />
    : <FormRendererEmpty />;

  return (
    <DeviceProvider device={device}>
      {device === "mobile" ? <MobileScope containOverlays={containOverlays}>{content}</MobileScope> : content}
    </DeviceProvider>
  );
}

const emptyStateCss = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "48px 24px",
  textAlign: "center",
  color: globalCssVars.colorTextTertiary,

  "& svg": {
    width: 28,
    height: 28
  }
});

/**
 * Shown when the requested device has no design yet — the renderer never falls
 * back to the other device's layout.
 */
function FormRendererEmpty(): ReactElement {
  return (
    <div css={emptyStateCss}>
      <EditorIcon name="smartphone" />
      <span>此设备尚未配置表单</span>
    </div>
  );
}

interface FormRendererInnerProps {
  renderFieldExtra?: FormRendererProps["renderFieldExtra"];
  runtimeSchema: RuntimeSchema;
  defaultValues?: RuntimeFormValues;
  disabled?: boolean;
  fieldPermissions?: Record<string, FieldPermission>;
  evaluators?: LinkageEvaluators;
  services?: FormServices;
  codeSetQueryFn?: CodeSetQueryFn;
  evaluationContext?: EvaluationContext;
  onSubmit?: (values: RuntimeFormValues) => void | Promise<void>;
  apiRef?: Ref<FormRendererApi>;
}

/**
 * The editor store owns schema/layout. This component owns runtime form state:
 * values, validation, submission, and linkage effects are delegated to the
 * components package's TanStack Form wrapper. Layout is document flow — blocks
 * stack vertically and a hidden block emits nothing, so the stack closes up with
 * no hole. Subform templates evaluate linkage per row, so the same reflow holds
 * inside a repeating group.
 */
function FormRendererInner({
  apiRef,
  codeSetQueryFn,
  defaultValues,
  disabled = false,
  evaluators,
  evaluationContext: hostContext,
  fieldPermissions,
  onSubmit,
  renderFieldExtra,
  runtimeSchema,
  services
}: FormRendererInnerProps): ReactElement {
  // Depend on the host context's individual slots, not the wrapper object: a host
  // passing an inline `evaluationContext` would otherwise mint a new object every
  // render, re-seeding `$vars` (clobbering `set_variable` writes) and churning
  // `ctx` (a full field re-render) on every keystroke.
  const hostVariables = hostContext?.variables;
  const hostUser = hostContext?.user;
  const hostNode = hostContext?.node;
  const hostApplicant = hostContext?.applicant;
  const hostGlobals = hostContext?.globals;

  // `$vars` is a reactive store seeded from the schema's variable defaults (with
  // host overrides on top); a `set_variable` action mutates it, and re-seeds
  // whenever the seed changes (a new schema / host variables).
  const seededVariables = useMemo(
    () => { return { ...deriveEvaluationVariables(runtimeSchema), ...hostVariables }; },
    [runtimeSchema, hostVariables]
  );
  const [variables, setVariables] = useState(seededVariables);
  // Re-seed only on an actual content change: a host passing an inline
  // `evaluationContext.variables` object mints a new (deeply equal) seed every
  // render, and an identity-keyed re-seed would clobber `set_variable` writes
  // on each host re-render.
  const appliedSeedRef = useRef(seededVariables);
  useEffect(() => {
    if (isDeepEqual(appliedSeedRef.current, seededVariables)) {
      return;
    }

    appliedSeedRef.current = seededVariables;
    setVariables(seededVariables);
  }, [seededVariables]);

  const evaluationContext = useMemo<EvaluationContext>(
    () => {
      return {
        variables,
        user: hostUser,
        node: hostNode,
        applicant: hostApplicant,
        globals: hostGlobals
      };
    },
    [variables, hostUser, hostNode, hostApplicant, hostGlobals]
  );

  const evaluationContextRef = useRef<EvaluationContext>(evaluationContext);
  evaluationContextRef.current = evaluationContext;

  const setVariable = useCallback<SetVariable>(
    (name, value) => {
      // Writing the value a variable already holds must keep the previous
      // object: the `$vars` identity feeds the condition-effect detector's
      // deps, so an unconditional spread would re-run it after every
      // `set_variable` — with an opaque `always` rule, an infinite loop.
      // Deep-equal (mirroring `set_fields`'s no-op bail): an expression-
      // resolved value may be a fresh but content-equal object, and treating
      // that as a change would cascade a form-wide re-evaluation for nothing.
      //
      // Also update the live ref synchronously so an in-flight sequence
      // resuming in the next microtask (before React flushes state) reads the
      // new `$vars` immediately.
      const { current } = evaluationContextRef;

      if (!isDeepEqual(current.variables?.[name], value)) {
        evaluationContextRef.current = {
          ...current,
          variables: { ...current.variables, [name]: value }
        };
      }

      setVariables(prev => isDeepEqual(prev[name], value) ? prev : { ...prev, [name]: value });
    },
    []
  );

  // Data-source refresh nonce: a `refresh_data_source` action bumps the version
  // for a source id, and `useFieldOptions` folds it into its fetch deps, so every
  // field referencing that source re-resolves through `services.request` on demand.
  const [dataSourceVersions, setDataSourceVersions] = useState<Record<string, number>>({});
  const refreshDataSource = useCallback<RefreshDataSource>(
    id => {
      setDataSourceVersions(prev => {
        return { ...prev, [id]: (prev[id] ?? 0) + 1 };
      });
    },
    []
  );

  const [sequenceController] = useState(() => new SequenceController());
  const [recordSelector] = useState(() => new RecordSelectorController());
  const knownOptionsRef = useRef<KnownOptionsLookup>(() => undefined);
  const getKnownOptions = useCallback<KnownOptionsLookup>(
    (...lookupArgs) => knownOptionsRef.current(...lookupArgs),
    []
  );

  // Whether any data-source parameter is bound to the form. Computed once per
  // schema so a form that binds nothing keeps the scope provider's values
  // subscription closed and its selects out of the keystroke re-render path.
  const boundParams = useMemo(() => schemaHasBoundParams(runtimeSchema), [runtimeSchema]);

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const resolvedEvaluators = useMemo(() => resolveLinkageEvaluators(evaluators), [evaluators]);
  const resolvedEvaluatorsRef = useRef(resolvedEvaluators);
  resolvedEvaluatorsRef.current = resolvedEvaluators;

  const fieldPermissionsRef = useRef(fieldPermissions);
  fieldPermissionsRef.current = fieldPermissions;

  const servicesRef = useRef(services);
  servicesRef.current = services;

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const runtimeSchemaRef = useRef(runtimeSchema);
  runtimeSchemaRef.current = runtimeSchema;

  const formRef = useRef<RuntimeForm | null>(null);
  const loadedFormRef = useRef<RuntimeForm | null>(null);
  const inFlightSubmitRef = useRef<Promise<void> | null>(null);
  const resetGenerationRef = useRef(0);
  const activeSubmitGenerationRef = useRef<number | null>(null);

  // Unified submit gate shared by native `<form onSubmit>`, `FormRendererApi.submit`,
  // and `submit` actions: concurrent external calls coalesce onto the single
  // in-flight Promise; an external reset while waiting cancels the pending
  // submit before validation runs.
  const submitForm = useCallback((): Promise<void> => {
    if (inFlightSubmitRef.current !== null) {
      return inFlightSubmitRef.current;
    }

    const deferred = Promise.withResolvers<void>();

    inFlightSubmitRef.current = deferred.promise;

    const finish = (): void => {
      if (inFlightSubmitRef.current !== deferred.promise) {
        return;
      }

      inFlightSubmitRef.current = null;
      activeSubmitGenerationRef.current = null;
    };

    const startGeneration = resetGenerationRef.current;

    activeSubmitGenerationRef.current = startGeneration;

    const invoke = (): Promise<void> => {
      if (resetGenerationRef.current !== startGeneration) {
        return Promise.resolve();
      }

      const currentForm = formRef.current;

      return currentForm ? Promise.resolve(currentForm.handleSubmit()) : Promise.resolve();
    };

    let work: Promise<void>;

    try {
      work = sequenceController.hasPendingRequests()
        ? sequenceController.waitForPendingRequests().then(invoke)
        : invoke();
    } catch (error) {
      finish();
      deferred.reject(error);

      return deferred.promise;
    }

    work.then(
      () => {
        finish();
        deferred.resolve();
      },
      (error: unknown) => {
        finish();
        deferred.reject(error);
      }
    );

    return deferred.promise;
  }, [sequenceController]);

  // Action-triggered `submit` step: if a submission is already in progress
  // (e.g. inside `beforeSubmit` / `afterSubmit` or concurrent with another
  // waiting submit), resolve immediately without deadlocking or recursing.
  const submitFormFromAction = useCallback<SubmitForm>(() => {
    if (inFlightSubmitRef.current !== null) {
      return Promise.resolve();
    }

    return submitForm();
  }, [submitForm]);

  const resetForm = useCallback<ResetForm>(keepRunId => {
    resetGenerationRef.current += 1;

    if (keepRunId === undefined) {
      sequenceController.abortAll();
    } else {
      sequenceController.abortOthers(keepRunId);
    }

    formRef.current?.reset();
  }, [sequenceController]);

  const resetFormExternal = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const sinks = useMemo<EffectSinks>(
    () => {
      return {
        setVariable,
        refreshDataSource,
        submitForm: submitFormFromAction,
        resetForm,
        pickRecord: recordSelector.pickRecord
      };
    },
    [setVariable, refreshDataSource, submitFormFromAction, resetForm, recordSelector]
  );

  const sequenceEnvRef = useRef<SequenceEnv | null>(null);
  const form = useRuntimeForm({
    activeSubmitGenerationRef,
    defaultValues,
    envRef: sequenceEnvRef,
    onSubmitRef,
    resetGenerationRef,
    runtimeSchema,
    runtimeSchemaRef
  });

  formRef.current = form;

  const sequenceEnv = useMemo<SequenceEnv>(
    () => {
      return {
        controller: sequenceController,
        form,
        sinks,
        getDisabled: () => disabledRef.current,
        getEvaluationContext: () => evaluationContextRef.current,
        getEvaluators: () => resolvedEvaluatorsRef.current,
        getFieldPermissions: () => fieldPermissionsRef.current,
        getKnownOptions,
        getServices: () => servicesRef.current
      };
    },
    [form, getKnownOptions, sequenceController, sinks]
  );

  sequenceEnvRef.current = sequenceEnv;

  const surfaceGate = useMemo<FormSurfaceGate>(
    () => {
      return {
        onSubmit: submitForm,
        onReset: resetFormExternal
      };
    },
    [resetFormExternal, submitForm]
  );

  const { AppForm, Form } = form;

  useImperativeHandle(apiRef, () => {
    return {
      submit: () => submitForm(),
      reset: () => resetFormExternal(),
      waitForPendingSequences: () => sequenceController.waitForPendingRequests(),
      getValues: () => form.state.values,
      // `getSubmitValues` reads the live store synchronously without awaiting
      // in-flight requests (Rule 4). Callers that need pending backfills to
      // settle first await `waitForPendingSequences()` explicitly.
      getSubmitValues: () => filterSubmitValues({
        blocks: runtimeSchemaRef.current.children,
        evaluators: resolvedEvaluatorsRef.current,
        evaluationContext: evaluationContextRef.current,
        fieldPermissions: fieldPermissionsRef.current,
        values: form.state.values
      })
    };
  }, [form, resetFormExternal, sequenceController, submitForm]);

  // Run `load` once per form instance and abort all in-flight sequences when
  // the form unmounts or swaps instance. `sequenceEnv` reads live refs on
  // every step, so `load` does not re-fire on re-renders while StrictMode
  // cleanup + re-run executes cleanly.
  useEffect(() => {
    if (loadedFormRef.current !== form) {
      loadedFormRef.current = form;

      dispatchFormSequences({
        env: sequenceEnv,
        schema: runtimeSchemaRef.current,
        scopeId: FORM_LIFECYCLE_SCOPE_ID,
        sequences: getTriggerEffectSequences(runtimeSchemaRef.current.linkage?.rules, "load"),
        stopOnIncomplete: false
      }).catch((error: unknown) => {
        console.error("[form-editor] load effect failed:", error);
      });
    }

    return () => {
      // If cleanup aborts an in-flight async `load` sequence (e.g. StrictMode
      // simulated unmount), clear the latch so the remount dispatches it again;
      // a synchronous `load` that already completed stays latched and fires once.
      if (sequenceController.hasActiveRuns(FORM_LIFECYCLE_SCOPE_ID)) {
        loadedFormRef.current = null;
      }

      sequenceController.abortAll();
    };
  }, [form, sequenceController, sequenceEnv]);

  const domIdPrefix = useId();
  const codeSets = useMemo(() => collectCodeSets(runtimeSchema), [runtimeSchema]);

  // Memoized so the field tree's props are stable across the controller's
  // per-keystroke re-renders — a precondition for `React.memo(BlockCell)` to
  // actually bail. The form instance and `sequenceEnv` are stable; only
  // schema/disabled/permission changes drive it.
  const ctx = useMemo<RenderCtx>(
    () => {
      return {
        boundParams,
        disabled,
        domIdPrefix,
        env: sequenceEnv,
        evaluators,
        fieldPermissions,
        form,
        gutter: resolveStackGap(runtimeSchema.gap, DEFAULT_STACK_GAP),
        initialValues: defaultValues,
        namePrefix: "",
        renderFieldExtra
      };
    },
    [boundParams, defaultValues, disabled, domIdPrefix, evaluators, fieldPermissions, form, renderFieldExtra, runtimeSchema.gap, sequenceEnv]
  );

  return (
    <AppForm>
      <SequenceControllerProvider controller={sequenceController}>
        <EvaluationScopeContext value={evaluationContext}>
          <DataSourceProvider dataSources={runtimeSchema.dataSources} request={services?.request} versions={dataSourceVersions}>
            <CodeSetProvider codeSets={codeSets} queryFn={codeSetQueryFn}>
              <KnownOptionsBridge lookupRef={knownOptionsRef} />

              <RuntimeStateController
                boundParams={boundParams}
                disabled={disabled}
                env={sequenceEnv}
                evaluationContext={evaluationContext}
                evaluators={evaluators}
                fieldPermissions={fieldPermissions}
                schema={runtimeSchema}
              >
                <FormSurfaceGateContext value={surfaceGate}>
                  <Form component={FormSurface} css={rootCss} disabled={disabled}>
                    <BlockStack blocks={runtimeSchema.children} ctx={ctx} />
                  </Form>
                </FormSurfaceGateContext>
              </RuntimeStateController>

              <RecordSelectorHost controller={recordSelector} />
            </CodeSetProvider>
          </DataSourceProvider>
        </EvaluationScopeContext>
      </SequenceControllerProvider>
    </AppForm>
  );
}

/**
 * The per-block linkage consumer (reads its own runtime state for the hidden /
 * disabled / required outcome), rendered 100-200× on a dense tab. A hidden block
 * emits nothing, so the stack's flex `gap` closes up with no hole. Memoized so a
 * parent re-render — e.g. a sibling hiding, or a subform row re-rendering — does
 * not re-invoke unaffected cells; effective because `ctx` is memoized and
 * `block` is schema-stable, so only a cell whose own state flips re-renders.
 */
function BlockCellBase({ block, ctx }: { block: Block; ctx: RenderCtx }): ReactElement | null {
  const runtimeState = useRuntimeFieldState(block.id);

  if (runtimeState.hidden) {
    return null;
  }

  const body = <BlockBody block={block} ctx={ctx} runtimeState={runtimeState} />;

  // Size/place the block per its stack slot when set. The wrapper lives inside
  // the hidden guard above, so a hidden block still emits nothing — never an
  // empty sized box that would leave a hole in the stack's gap.
  return block.stack === undefined ? body : <div style={stackSlotStyle(block.stack)}>{body}</div>;
}

const BlockCell = memo(BlockCellBase);

/**
 * A vertical stack of blocks (the document body, and section / tabs / subform
 * bodies). Blocks flow top-to-bottom with the resolved `gap` between them — the
 * container's own {@link GapScale} when set, else the inherited form-level gap
 * ({@link RenderCtx.gutter}). Each cell drops out when its own linkage hides it,
 * so the stack closes up with no hole.
 */
function BlockStack({
  blocks,
  ctx,
  gap
}: { blocks: Block[]; ctx: RenderCtx; gap?: GapScale }): ReactElement {
  return (
    <Stack gap={resolveStackGap(gap, ctx.gutter)}>
      {blocks.map(block => <BlockCell key={block.id} block={block} ctx={ctx} />)}
    </Stack>
  );
}

function BlockBody({
  block,
  ctx,
  runtimeState
}: {
  block: Block;
  ctx: RenderCtx;
  runtimeState: RuntimeFieldState;
}): ReactElement | null {
  function withExtra(content: ReactElement, field: FormField | SubformNode) {
    if (!ctx.renderFieldExtra || !("key" in field) || !field.key) {
      return content;
    }

    const extra = ctx.renderFieldExtra({
      key: ctx.rowLocation?.key ?? field.key,
      type: field.type,
      label: field.label,
      ...ctx.rowLocation && { row: ctx.rowLocation.row, column: field.key }
    });
    return extra === null || extra === undefined
      ? content
      : (
          <div>
            {content}
            {extra}
          </div>
        );
  }

  switch (block.type) {
    case "section": {
      return <SectionFlow ctx={withRuntimeDisabled(ctx, runtimeState)} section={block} />;
    }

    case "tabs": {
      return <TabsFlow ctx={withRuntimeDisabled(ctx, runtimeState)} tabs={block} />;
    }

    case "subform": {
      return withExtra(<SubformFlow ctx={withRuntimeDisabled(ctx, runtimeState)} subform={block} />, block);
    }

    case "flex": {
      return <FlexFlow ctx={withRuntimeDisabled(ctx, runtimeState)} flex={block} />;
    }

    case "grid": {
      return <GridFlow ctx={withRuntimeDisabled(ctx, runtimeState)} grid={block} />;
    }

    default: {
      return withExtra(<FieldSlot ctx={ctx} field={block} runtimeState={runtimeState} />, block);
    }
  }
}

function FlexSlotCellBase({ block, ctx }: { block: Block; ctx: RenderCtx }): ReactElement | null {
  const runtimeState = useRuntimeFieldState(block.id);

  if (runtimeState.hidden) {
    return null;
  }

  return (
    <div style={flexSlotStyle(block.flex)}>
      <BlockBody block={block} ctx={ctx} runtimeState={runtimeState} />
    </div>
  );
}

const FlexSlotCell = memo(FlexSlotCellBase);

/**
 * Flex layout container. Lays its child blocks along one axis via CSS flexbox;
 * each slot is sized by its block's own {@link FlexSlot}. A hidden slot emits
 * nothing, so flex repacks the survivors — the same reflow as a grid row. The
 * container's row-list is flattened to its blocks (each "row" is one slot).
 */
function FlexFlow({ ctx, flex }: { ctx: RenderCtx; flex: FlexNode }): ReactElement {
  const blocks = flex.children;

  return (
    <Flex
      align={FLEX_ALIGN_MAP[flex.align ?? "start"]}
      gap={flex.gap ?? ctx.gutter}
      justify={FLEX_JUSTIFY_MAP[flex.justify ?? "start"]}
      vertical={flex.direction === "column"}
      wrap={flex.wrap ? "wrap" : "nowrap"}
    >
      {blocks.map(block => <FlexSlotCell key={block.id} block={block} ctx={ctx} />)}
    </Flex>
  );
}

/**
 * Grid layout container. Lays its child blocks (cells) across a fixed number of
 * equal-width columns via real CSS grid; a cell's `span` widens it. A hidden
 * cell emits nothing, so the grid repacks the survivors — the same reflow as a
 * grid row. The container's row-list is flattened to its blocks (each "row" is
 * one cell).
 */
function GridFlow({ ctx, grid }: { ctx: RenderCtx; grid: GridNode }): ReactElement {
  const blocks = grid.children;
  const columns = gridColumnCount(grid);

  return (
    <div style={gridContainerStyle(grid, ctx.gutter)}>
      {/* eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering */}
      {blocks.map(block => <GridCell key={block.id} block={block} columns={columns} ctx={ctx} />)}
    </div>
  );
}

function GridCellBase({
  block,
  columns,
  ctx
}: { block: Block; columns: number; ctx: RenderCtx }): ReactElement | null {
  const runtimeState = useRuntimeFieldState(block.id);

  if (runtimeState.hidden) {
    return null;
  }

  return (
    <div style={gridCellStyle(block.span, columns)}>
      <BlockBody block={block} ctx={ctx} runtimeState={runtimeState} />
    </div>
  );
}

const GridCell = memo(GridCellBase);

/**
 * Propagate a container's runtime `disabled` state into its body's ctx, so a
 * `disable` linkage rule on a section / tabs / subform disables every
 * descendant field — matching how `show` / `hide` already work on containers.
 * Returns the same ctx reference when nothing changes, so the memoized cells
 * below only re-render when the container's disabled state actually flips.
 */
function withRuntimeDisabled(ctx: RenderCtx, runtimeState: RuntimeFieldState): RenderCtx {
  return runtimeState.disabled && !ctx.disabled ? { ...ctx, disabled: true } : ctx;
}

function SectionFlow({ ctx, section }: { ctx: RenderCtx; section: SectionNode }): ReactElement {
  const chrome = useContainerChrome();
  const defaultCollapsed = section.variant === "collapse" ? section.defaultCollapsed : undefined;

  return (
    <chrome.Section defaultCollapsed={defaultCollapsed} title={section.title} variant={section.variant}>
      <BlockStack blocks={section.children} ctx={ctx} gap={section.gap} />
    </chrome.Section>
  );
}

function TabsFlow({ ctx, tabs }: { ctx: RenderCtx; tabs: TabsNode }): ReactElement {
  const chrome = useContainerChrome();
  const items: ChromeTabItem[] = tabs.tabs.map(tab => {
    return {
      children: <BlockStack blocks={tab.children} ctx={ctx} gap={tabs.gap} />,
      key: tab.id,
      label: tab.label
    };
  });

  return <chrome.Tabs items={items} />;
}

/**
 * Reconcile the parallel row-key list against the array field's current length
 * (the antd `Form.List` pattern). The wrapped add / remove handlers keep the
 * list aligned for their own mutations; this covers an EXTERNAL array
 * replacement — a `set_fields` writing the subform key, or a form `reset`:
 * growth appends fresh keys, shrinkage truncates. Identity is therefore
 * positional under wholesale replacement (surviving positions keep their key);
 * only push / splice mutations carry per-row identity exactly. Mutates the
 * ref'd list in render — idempotent, so a StrictMode double render (or a
 * discarded concurrent render followed by a re-render) converges to the same
 * keys.
 */
function reconcileRowKeys(keys: string[], length: number, seed: RefObject<number>): void {
  while (keys.length < length) {
    seed.current += 1;
    keys.push(`row-${seed.current}`);
  }

  if (keys.length > length) {
    keys.length = length;
  }
}

// Stable empty array: a fresh `[]` per selector run would churn the
// subscription on every store notification.
const EMPTY_ERRORS: unknown[] = [];

/**
 * Unified subform renderer for both `stack` and `table` variants. Both bind to
 * the same TanStack Form array field, share row-key reconciliation, fixed-row
 * seeding, add/remove bounds, per-row linkage controllers (`SubformRowScope`),
 * and field rendering (`FieldSlot`). Only the presentation layout differs: on
 * PC, `variant: "table"` lays each row out as directly-editable table cells;
 * `stack` (and `table` on mobile) lays each row out as a card/block stack.
 */
function SubformFlow({ ctx, subform }: { ctx: RenderCtx; subform: SubformNode }): ReactElement {
  const chrome = useContainerChrome();
  const device = useDevice();
  const tableSubform = subform.variant === "table" && device === "pc" ? subform : undefined;
  const arrayName = `${ctx.namePrefix}${subform.key}`;
  // The subform mounts ONE array field for subform-level errors ("at least one
  // row" when required); per-cell errors render directly inside each cell.
  const fieldErrors = useFormStore(ctx.form.store, state => state.fieldMeta[arrayName]?.errors ?? EMPTY_ERRORS);
  const rowsEmpty = useFormStore(ctx.form.store, state => {
    const raw = resolveScopeValues(state.values, ctx.namePrefix)[subform.key];

    return !Array.isArray(raw) || raw.length === 0;
  });
  const fixed = isFixedSubform(subform) ? subform.rows : undefined;
  const dynamic = getDynamicSubformRows(subform);
  const minRows = dynamic.min ?? 0;
  const fixedStatus = useFixedSubformRows({
    arrayName,
    form: ctx.form,
    initialValues: ctx.initialValues,
    namePrefix: ctx.namePrefix,
    rowsEmpty,
    subform
  });
  const tableColumns = useMemo(
    () => tableSubform ? tableSubform.template.filter(block => isTableColumnField(block)) : undefined,
    [tableSubform]
  );
  const rowKeysRef = useRef<string[]>([]);
  const rowKeySeedRef = useRef(0);
  // The live array field api for the stable handlers below; written during the
  // render prop (idempotent — same value every invocation of a render pass).
  const arrayApiRef = useRef<RuntimeArrayFieldApi | null>(null);

  const handleAdd = useCallback(() => {
    rowKeySeedRef.current += 1;
    rowKeysRef.current.push(`row-${rowKeySeedRef.current}`);
    arrayApiRef.current?.pushValue(blankSubformRow(subform));
  }, [subform]);

  const handleRemove = useCallback((index: number) => {
    // Splice the key together with the value so the surviving rows keep their
    // identity (reconciliation-by-length alone would truncate the tail key and
    // misassign the survivors).
    rowKeysRef.current.splice(index, 1);
    arrayApiRef.current?.removeValue(index);
  }, []);

  return (
    <chrome.Subform errors={formatErrors(fieldErrors)} title={subform.label}>
      <FixedSubformStatusBanner status={fixedStatus} />

      <ctx.form.AppField mode="array" name={arrayName}>
        {(fieldApi: RuntimeArrayFieldApi) => {
          arrayApiRef.current = fieldApi;

          const rows = Array.isArray(fieldApi.state.value) ? fieldApi.state.value : [];
          let rowKeys: string[];

          if (fixed) {
            rowKeys = deriveFixedRowKeys(rows, fixed.itemKey);
          } else {
            reconcileRowKeys(rowKeysRef.current, rows.length, rowKeySeedRef);
            rowKeys = rowKeysRef.current;
          }

          if (tableSubform && fixed && rows.length === 0 && (fixedStatus?.loading || fixedStatus?.error || fixedStatus?.empty)) {
            return null;
          }

          const canRemove = !fixed && !ctx.disabled && rows.length > minRows;
          const canAdd = !fixed && !ctx.disabled && (dynamic.max === undefined || rows.length < dynamic.max);

          return (
            <>
              {tableSubform && tableColumns
                ? (
                    <SubformTableFrame
                      canRemove={canRemove}
                      columns={tableColumns}
                      domIdPrefix={ctx.domIdPrefix}
                      empty={rows.length === 0}
                      fixed={fixed}
                      namePrefix={ctx.namePrefix}
                      renderFieldExtra={ctx.renderFieldExtra}
                      subform={tableSubform}
                    >
                      {rows.map((row, index) => (
                        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering
                        <SubformTableRow
                          key={rowKeys[index]}
                          canRemove={canRemove}
                          columns={tableColumns}
                          ctx={ctx}
                          fixed={fixed}
                          fixedHeaderLabel={fixed ? fixedRowItemLabel(row, fixed.itemKey) : undefined}
                          index={index}
                          subform={tableSubform}
                          onRemove={handleRemove}
                        />
                      ))}
                    </SubformTableFrame>
                  )
                : rows.map((row, index) => (
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering
                    <SubformRow
                      key={rowKeys[index]}
                      canRemove={canRemove}
                      ctx={ctx}
                      header={fixed ? fixedRowItemLabel(row, fixed.itemKey) : undefined}
                      index={index}
                      subform={subform}
                      onRemove={handleRemove}
                    />
                  ))}

              {canAdd
                ? (
                    <chrome.AddButton
                      label={dynamicAddRowLabel(dynamic)}
                      onClick={handleAdd}
                    />
                  )
                : null}
            </>
          );
        }}
      </ctx.form.AppField>
    </chrome.Subform>
  );
}

/**
 * Shared row-scope derivation for both {@link SubformRow} and
 * {@link SubformTableRow}: builds the per-row name prefix, stable template
 * schema, and memoized child `RenderCtx` (clearing root-only `fieldPermissions`
 * and stamping `rowLocation` for `renderFieldExtra`).
 */
function useSubformRowContext(
  ctx: RenderCtx,
  subform: SubformNode,
  index: number
): { rowCtx: RenderCtx; rowPrefix: string; templateSchema: RuntimeSchema } {
  const rowPrefix = `${ctx.namePrefix}${subform.key}[${index}].`;
  const templateSchema = useMemo<RuntimeSchema>(
    () => {
      return {
        id: subform.id,
        children: subform.template
      };
    },
    [subform.id, subform.template]
  );
  // Re-prefixed ctx for the row's descendants; memoized so the row subtree's
  // memoized cells don't thrash on the controller's re-renders. The permission
  // clamp is dropped here: top-level permissions clamp the subform node itself,
  // never a template field individually.
  const rowCtx = useMemo<RenderCtx>(
    () => {
      return {
        ...ctx,
        namePrefix: rowPrefix,
        rowLocation: { key: subform.key, row: index },
        fieldPermissions: undefined
      };
    },
    [ctx, rowPrefix, subform.key, index]
  );

  return {
    rowCtx,
    rowPrefix,
    templateSchema
  };
}

/**
 * One stacked subform row. A {@link SubformRowController} subscribes to this
 * row's value slice and publishes a nested runtime-state scope, so
 * hide/disable/require reflow and `assign` work inside the row exactly as they
 * do at the root — and only this row re-evaluates when its own record changes.
 *
 * Memoized with stable props (see {@link SubformFlow}) so a keystroke in one row
 * — which re-runs the array field's render prop — does not re-render the other
 * rows' controllers. Load-bearing at 100s of fields: without it every keystroke
 * in any row re-evaluates every row's template.
 */
function SubformRowBase({
  canRemove,
  ctx,
  header,
  index,
  onRemove,
  subform
}: {
  canRemove: boolean;
  ctx: RenderCtx;
  header?: ReactNode;
  index: number;
  onRemove: (index: number) => void;
  subform: SubformNode;
}): ReactElement {
  const chrome = useContainerChrome();
  const {
    rowCtx,
    rowPrefix,
    templateSchema
  } = useSubformRowContext(ctx, subform, index);

  return (
    <chrome.SubformRow header={header} removeControl={canRemove ? <chrome.RemoveButton onClick={() => onRemove(index)} /> : undefined}>
      {subformRowHeading(subform, index, ctx.renderFieldExtra)}

      <SubformRowScope ctx={ctx} prefix={rowPrefix} templateSchema={templateSchema}>
        <BlockStack blocks={subform.template} ctx={rowCtx} gap={subform.variant === "stack" ? subform.gap : undefined} />
      </SubformRowScope>
    </chrome.SubformRow>
  );
}

const SubformRow = memo(SubformRowBase);

/**
 * One directly-editable table subform row, sharing the exact same per-row
 * linkage controller, bound-parameter scope, memoization boundary, and field
 * slot renderer as {@link SubformRow}. Takes only primitive `fixedHeaderLabel`
 * (never the mutable row record) so typing inside one row keeps every row's
 * memo airtight.
 */
function SubformTableRowBase({
  canRemove,
  columns,
  ctx,
  fixed,
  fixedHeaderLabel,
  index,
  onRemove,
  subform
}: {
  canRemove: boolean;
  columns: readonly KeyedFormField[];
  ctx: RenderCtx;
  fixed?: FixedSubformRows;
  fixedHeaderLabel?: string;
  index: number;
  onRemove: (index: number) => void;
  subform: SubformNode;
}): ReactElement {
  const chrome = useContainerChrome();
  const {
    rowCtx,
    rowPrefix,
    templateSchema
  } = useSubformRowContext(ctx, subform, index);
  const fixedHeading = fixed ? subformRowHeading(subform, index, ctx.renderFieldExtra) : null;

  return (
    <tr>
      {fixed
        ? (
            <td css={tableFixedHeaderCellCss} style={fixedHeaderColumnStyle(fixed.headerWidth)}>
              {fixedHeading ? <div css={tableRowHeadingCss}>{fixedHeading}</div> : null}
              <span>{fixedHeaderLabel}</span>
            </td>
          )
        : null}

      <SubformRowScope ctx={ctx} prefix={rowPrefix} templateSchema={templateSchema}>
        {columns.map((field, columnIndex) => (
          // eslint-disable-next-line @typescript-eslint/no-use-before-define -- co-located row cell component
          <SubformTableCell
            key={field.id}
            ctx={rowCtx}
            field={field}
            headerId={tableColumnHeaderId(ctx.domIdPrefix, ctx.namePrefix, subform.key, field.id)}
            index={index}
            showRowHeading={!fixed && columnIndex === 0}
            subform={subform}
          />
        ))}
      </SubformRowScope>

      {canRemove
        ? (
            <td css={tableRemoveCellCss}>
              <chrome.RemoveButton onClick={() => onRemove(index)} />
            </td>
          )
        : null}
    </tr>
  );
}

const SubformTableRow = memo(SubformTableRowBase);

/**
 * One table cell. Reads its own per-row runtime state via selector context so
 * typing or linkage flips elsewhere in the row never re-render untouched cells.
 * When per-row linkage hides the field, keeps the `<td>` mounted empty so later
 * columns stay aligned under their headers.
 */
function SubformTableCellBase({
  ctx,
  field,
  headerId,
  index,
  showRowHeading,
  subform
}: {
  ctx: RenderCtx;
  field: KeyedFormField;
  headerId: string;
  index: number;
  showRowHeading: boolean;
  subform: SubformNode;
}): ReactElement {
  const runtimeState = useRuntimeFieldState(field.id);
  const cellContext = useMemo(
    () => {
      return { labelId: headerId };
    },
    [headerId]
  );
  const rowHeading = showRowHeading ? subformRowHeading(subform, index, ctx.renderFieldExtra) : null;
  const cellExtra = !runtimeState.hidden && ctx.renderFieldExtra
    ? ctx.renderFieldExtra({
        key: subform.key,
        type: field.type,
        label: field.label,
        row: index,
        column: field.key
      })
    : null;

  return (
    <td css={tableDataCellCss} style={tableColumnStyle(field)}>
      {rowHeading ? <div css={tableRowHeadingCss}>{rowHeading}</div> : null}

      {runtimeState.hidden
        ? null
        : (
            <FieldCellProvider value={cellContext}>
              <FieldSlot ctx={ctx} field={field} runtimeState={runtimeState} />
            </FieldCellProvider>
          )}

      {cellExtra !== null && cellExtra !== undefined
        ? <div css={tableCellExtraCss}>{cellExtra}</div>
        : null}
    </td>
  );
}

const SubformTableCell = memo(SubformTableCellBase);

/**
 * Bridges the reactive evaluation scope into the row controller. The context
 * subscription lives HERE — a separate, deliberately non-memoized component
 * beneath {@link SubformRow}'s memo — so a `$vars` write re-renders only this
 * bridge (the controller re-evaluates the row against the fresh scope, as it
 * must: any row condition may read `$vars`), while the row chrome, the remove
 * button, and the stable `children` element above it all bail. `ctx` only
 * carries a stable ref (for validators), never this live value.
 */
function SubformRowScope({
  children,
  ctx,
  prefix,
  templateSchema
}: {
  children: ReactNode;
  ctx: RenderCtx;
  prefix: string;
  templateSchema: RuntimeSchema;
}): ReactElement {
  const evaluationContext = use(EvaluationScopeContext);

  return (
    <SubformRowController
      boundParams={ctx.boundParams}
      disabled={ctx.disabled}
      env={ctx.env}
      evaluationContext={evaluationContext}
      evaluators={ctx.evaluators}
      prefix={prefix}
      templateSchema={templateSchema}
    >
      {children}
    </SubformRowController>
  );
}

function FieldSlot({
  ctx,
  field,
  runtimeState
}: {
  ctx: RenderCtx;
  field: FormField;
  runtimeState: RuntimeFieldState;
}): ReactElement {
  // The nearest value scope's sequence dispatcher (root form or subform row),
  // so a field event fires its sequences against the right record.
  const runSequences = useEffectDispatch();
  const registry = useFieldRegistry();
  const eventKinds = useMemo(() => getFieldEventTriggerKinds(field.linkage?.rules), [field.linkage]);
  // Schema-stable, so memoized: re-walking the linkage rules to build the
  // cross-field validation dependency list on every state-flip re-render is waste.
  const listenToKeys = useMemo(
    () => getLinkageSourceKeys(field).map(key => `${ctx.namePrefix}${key}`),
    [field, ctx.namePrefix]
  );
  const labelPosition = field.labelPosition ?? "top";
  // Globally-unique DOM id: the renderer-instance prefix separates co-mounted
  // renderers of the same schema, and the row name-prefix separates a subform
  // template's per-row instances — without both, duplicate ids cross-wire
  // label associations.
  const domId = `${ctx.domIdPrefix}field-${ctx.namePrefix}${field.id}`;
  const commitMode = registry.get(field.type)?.config.commit ?? "change";
  const hasCommit = eventKinds.has("commit");

  let content: ReactElement;

  if (isKeyedField(field)) {
    // Display-only clamp on the required marker: a non-writable-clamped field
    // is read-only, validation-exempt, and never submits, so it must not
    // advertise "required". The verdict comes from the permission map (the
    // same lookup as `filterSubmitValues`), NOT from `disabled` — a linkage
    // `disable` outcome keeps its marker. Validation semantics live in
    // `validateRuntimeField` / `collectSubmitErrors`, untouched here.
    const writable = isWritableFieldPermission(getFieldPermission(ctx.fieldPermissions, field.key));
    // Registered on the change lane only: TanStack Form's submit event runs the
    // change validator too (defaultValidationLogic), so submit-time coverage is
    // free — while a second registration under `onSubmit` would store the same
    // message in both errorMap lanes and render it twice after a failed submit.
    // `field` is narrowed to keyed in this branch, so the callback stays
    // type-safe without re-checking.
    const runValidation = ({ fieldApi, value }: { fieldApi: RuntimeFieldApi; value: unknown }): string | undefined => validateRuntimeField({
      disabled: ctx.disabled,
      evaluators: ctx.env.getEvaluators(),
      evaluationContext: ctx.env.getEvaluationContext(),
      field,
      fieldPermissions: ctx.fieldPermissions,
      namePrefix: ctx.namePrefix,
      value,
      values: fieldApi.form.state.values
    });

    const handleCommit = hasCommit && commitMode === "entry"
      ? () => runSequences(getTriggerEffectSequences(field.linkage?.rules, "commit"), field.id)
      : undefined;

    content = (
      <ctx.form.AppField
        name={`${ctx.namePrefix}${field.key}`}
        validators={{
          onChangeListenTo: listenToKeys,
          onChange: runValidation
        }}
      >
        {(fieldApi: RuntimeFieldApi) => (
          <FormFieldRenderer
            disabled={ctx.disabled || runtimeState.disabled}
            domId={domId}
            errors={formatErrors(fieldApi.state.meta.errors)}
            field={field}
            labelPosition={labelPosition}
            required={writable && isRuntimeRequired(field, runtimeState)}
            value={fieldApi.state.value}
            onChange={value => {
              fieldApi.handleChange(value);

              // The `change` edge fires off the framework onChange, not a DOM
              // event, so it is dispatched here rather than via the boundary.
              if (eventKinds.has("change")) {
                runSequences(getTriggerEffectSequences(field.linkage?.rules, "change"), field.id);
              }

              // Controls with `commit: "change"` (select, date, switch, etc.)
              // confirm on every user change; programmatic writes bypass this
              // callback entirely via `dontRunListeners: true`.
              if (hasCommit && commitMode === "change") {
                runSequences(getTriggerEffectSequences(field.linkage?.rules, "commit"), field.id);
              }
            }}
            onCommit={handleCommit}
          />
        )}
      </ctx.form.AppField>
    );
  } else {
    content = (
      <FormFieldRenderer
        disabled={ctx.disabled || runtimeState.disabled}
        domId={domId}
        field={field}
        labelPosition={labelPosition}
      />
    );
  }

  return needsDomEventBoundary(eventKinds)
    ? (
        <FieldEventBoundary
          eventKinds={eventKinds}
          ownerFieldId={field.id}
          rules={field.linkage?.rules}
          runSequences={runSequences}
        >
          {content}
        </FieldEventBoundary>
      )
    : content;
}

const eventBoundaryCss = css({ display: "contents" });

/**
 * Whether a field needs a DOM boundary to catch `focus` / `blur` / `click`
 * edges. The `change` and `commit` edges ride the field callbacks and never
 * need one, so a field with only `change` / `commit` (or no) event rules
 * renders with no wrapper.
 */
function needsDomEventBoundary(eventKinds: Set<LinkageTriggerKind>): boolean {
  return eventKinds.has("focus") || eventKinds.has("blur") || eventKinds.has("click");
}

/**
 * A `display: contents` wrapper that catches a field's `focus` / `blur` /
 * `click` edges by bubbling — no per-component prop threading and no layout box,
 * so it is transparent to antd's grid. Only the handlers a field actually
 * listens for are attached.
 */
function FieldEventBoundary({
  children,
  eventKinds,
  ownerFieldId,
  rules,
  runSequences
}: {
  children: ReactNode;
  eventKinds: Set<LinkageTriggerKind>;
  ownerFieldId: string;
  rules: FieldLinkageRule[] | undefined;
  runSequences: RunSequences;
}): ReactElement {
  return (
    <div
      css={eventBoundaryCss}
      onBlur={eventKinds.has("blur") ? () => runSequences(getTriggerEffectSequences(rules, "blur"), ownerFieldId) : undefined}
      onClick={eventKinds.has("click") ? () => runSequences(getTriggerEffectSequences(rules, "click"), ownerFieldId) : undefined}
      onFocus={eventKinds.has("focus") ? () => runSequences(getTriggerEffectSequences(rules, "focus"), ownerFieldId) : undefined}
    >
      {children}
    </div>
  );
}

function formatErrors(errors: unknown[]): string[] | undefined {
  const formatted = errors
    .filter(error => error !== null && error !== undefined && error !== false)
    .map(String);

  return formatted.length > 0 ? formatted : undefined;
}
