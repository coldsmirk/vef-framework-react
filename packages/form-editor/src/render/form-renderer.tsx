import type { ReactElement, ReactNode, Ref, RefObject } from "react";

import type { RuntimeFieldState } from "../engine/linkage";
import type { EffectSinks, RefreshDataSource, RunEffects, SetVariable } from "../runtime/effects";
import type { RuntimeForm, RuntimeFormValues } from "../runtime/types";
import type {
  Block,
  ChromeTabItem,
  DataSourceResolver,
  EvaluationContext,
  FieldLinkageRule,
  FlexNode,
  FormField,
  FormSchema,
  GapScale,
  GridNode,
  LinkageEvaluators,
  LinkageTriggerKind,
  PresentationDevice,
  RuntimeSchema,
  SectionNode,
  SubformNode,
  TableSubform,
  TabsNode
} from "../types";

import { css } from "@emotion/react";
import { EditableTable, Flex, globalCssVars, Stack, useForm } from "@vef-framework-react/components";
import { isDeepEqual } from "@vef-framework-react/shared";
import { createContext, memo, use, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";

import { MobileScope } from "../components/mobile/scope";
import { isKeyedField } from "../engine/keys";
import {
  deriveDefaultValues,
  deriveEvaluationVariables,
  getFieldEventTriggerKinds,
  getLinkageSourceKeys,
  getTriggerEffectActions
} from "../engine/linkage";
import { toRuntimeSchema } from "../engine/schema/presentation";
import { EditorIcon } from "../icons";
import { dispatchFormEffects, useEffectDispatch } from "../runtime/effects";
import { useRuntimeFieldState } from "../runtime/runtime-context";
import { RuntimeStateController, SubformRowController } from "../runtime/runtime-state-controller";
import { DeviceProvider, useContainerChrome, useDevice } from "../store/engine-provider";
import { DataSourceProvider } from "./data-source-context";
import { FLEX_ALIGN_MAP, FLEX_JUSTIFY_MAP, flexSlotStyle } from "./flex-style";
import { FormFieldRenderer } from "./form-field";
import { gridCellStyle, gridColumnCount, gridContainerStyle } from "./grid-style";
import { DEFAULT_STACK_GAP, resolveStackGap } from "./stack-style";
import { buildSubformColumns } from "./subform-columns";
import {
  blankSubformRow,
  buildRuntimeFormId,
  collectSubmitErrors,
  filterSubmitValues,
  isRuntimeRequired,
  validateRuntimeField
} from "./submit";

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
   * Overrides for the dynamic linkage evaluators. Expression and script slots
   * fall back to plain-JavaScript `new Function` compilation. Host projects
   * only need overrides for a sandbox, a custom expression engine, or a DSL.
   */
  evaluators?: LinkageEvaluators;
  /**
   * Host-injected resolver for `remote` option sources. Falls back to a no-op
   * (empty options) when omitted — static / ref-to-static sources never need it.
   */
  dataSourceResolver?: DataSourceResolver;
  /**
   * Host-supplied evaluation scope. `$vars` here merges over (and overrides) the
   * schema's variable defaults; `$user` / `$node` carry runtime context. The
   * form derives `$vars` from `schema.variables` on its own, so this is only
   * needed to supply user / node context or override a variable at runtime.
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
}

/**
 * The curated imperative surface of a rendered form. `submit` runs the same
 * validation + `onSubmit` pipeline as a schema submit button.
 */
export interface FormRendererApi {
  submit: () => Promise<void>;
  reset: () => void;
  getValues: () => RuntimeFormValues;
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
 * read this — they take a stable ref via {@link RenderCtx.evaluationContextRef}
 * so a variable change never busts their memo and re-renders the whole tree.
 */
const EvaluationScopeContext = createContext<EvaluationContext | undefined>(undefined);
EvaluationScopeContext.displayName = "EvaluationScopeContext";

interface RenderCtx {
  disabled: boolean;
  /**
   * Renderer-instance prefix (React `useId`) for every field's DOM id. Two
   * renderers of the same schema can legitimately share a page (a host
   * mounting form + preview, the editor's preview beside its kept-alive JSON
   * view), and without this the `field-${field.id}` ids would collide —
   * cross-wiring every label's `htmlFor` across the instances.
   */
  domIdPrefix: string;
  evaluators: LinkageEvaluators | undefined;
  /**
   * Stable ref to the form-composed evaluation scope (`$vars` from schema + host
   * `$user`/`$node`). A ref — not the value — so a `$vars` change does not bust
   * `ctx` identity and re-render every memoized cell; field validators read the
   * latest via `.current` at change/submit time. The reactive value reaches the
   * runtime-state controllers (which must re-evaluate) via {@link EvaluationScopeContext}.
   */
  evaluationContextRef: RefObject<EvaluationContext | undefined>;
  form: RuntimeFormApi;
  /**
   * The form-level stack gap in pixels (from the schema's `gap`), used as the
   * gap a container body inherits when it sets no `gap`, and as the default gap
   * for flex / grid containers.
   */
  gutter: number;
  /**
   * Field-name prefix for the current value scope, e.g. `"lines[0]."`.
   */
  namePrefix: string;
  /**
   * Renderer-owned effect sinks (`$vars` writes, data-source refreshes) the
   * effect lane dispatches into, in every value scope.
   */
  sinks: EffectSinks;
}

/**
 * Structural view of a TanStack Form array field's api (method bivariance).
 */
interface RuntimeArrayFieldApi {
  state: { value: unknown[] };
  pushValue: (value: unknown) => void;
  removeValue: (index: number) => void;
}

function useRuntimeForm(
  args: Pick<FormRendererProps, "defaultValues" | "disabled" | "evaluators" | "onSubmit"> & {
    runtimeSchema: RuntimeSchema;
    evaluationContext: EvaluationContext | undefined;
    formRef: RefObject<RuntimeForm | null>;
    sinks: EffectSinks;
  }
) {
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
        const fields = collectSubmitErrors({
          blocks: args.runtimeSchema.children,
          disabled: args.disabled ?? false,
          evaluators: args.evaluators,
          evaluationContext: args.evaluationContext,
          namePrefix: "",
          values: value
        });

        return Object.keys(fields).length > 0 ? { fields } : undefined;
      }
    },
    onSubmit: async ({ value }) => {
      const formRules = args.runtimeSchema.linkage?.rules;
      // `formRef` holds the live form once mounted; the lifecycle effects need
      // the React-augmented instance, not the bare TanStack submit `formApi`.
      const form = args.formRef.current;

      // Form-scope lifecycle effects bracket the submission: `beforeSubmit`
      // completes (including async host effects) before the host handler;
      // `afterSubmit` runs only after the handler resolves.
      if (form) {
        await dispatchFormEffects({
          actions: getTriggerEffectActions(formRules, "beforeSubmit"),
          evaluators: args.evaluators,
          evaluationContext: args.evaluationContext,
          form,
          sinks: args.sinks
        });
      }

      await args.onSubmit?.(filterSubmitValues({
        blocks: args.runtimeSchema.children,
        evaluators: args.evaluators,
        evaluationContext: args.evaluationContext,
        values: value
      }));

      if (form) {
        await dispatchFormEffects({
          actions: getTriggerEffectActions(formRules, "afterSubmit"),
          evaluators: args.evaluators,
          evaluationContext: args.evaluationContext,
          form,
          sinks: args.sinks
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
  runtimeSchema: RuntimeSchema;
  defaultValues?: RuntimeFormValues;
  disabled?: boolean;
  evaluators?: LinkageEvaluators;
  dataSourceResolver?: DataSourceResolver;
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
  dataSourceResolver,
  defaultValues,
  disabled = false,
  evaluators,
  evaluationContext: hostContext,
  onSubmit,
  runtimeSchema
}: FormRendererInnerProps): ReactElement {
  // Depend on the host context's individual slots, not the wrapper object: a host
  // passing an inline `evaluationContext` would otherwise mint a new object every
  // render, re-seeding `$vars` (clobbering `set_variable` writes) and churning
  // `ctx` (a full field re-render) on every keystroke.
  const hostVariables = hostContext?.variables;
  const hostUser = hostContext?.user;
  const hostNode = hostContext?.node;

  // `$vars` is a reactive store seeded from the schema's variable defaults (with
  // host overrides on top); a `set_variable` effect mutates it, and re-seeds
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
  const setVariable = useCallback<SetVariable>(
    (name, value) => {
      // Writing the value a variable already holds must keep the previous
      // object: the `$vars` identity feeds the condition-effect detector's
      // deps, so an unconditional spread would re-run it after every
      // `set_variable` — with an opaque `always` rule, an infinite loop.
      // Deep-equal (mirroring `set_field`'s no-op bail): an expression-
      // resolved value may be a fresh but content-equal object, and treating
      // that as a change would cascade a form-wide re-evaluation for nothing.
      setVariables(prev => isDeepEqual(prev[name], value) ? prev : { ...prev, [name]: value });
    },
    []
  );

  // Data-source refresh nonce: a `refresh_data_source` effect bumps the version
  // for a source id, and `useFieldOptions` folds it into its fetch deps, so every
  // field referencing that source re-resolves through the resolver on demand.
  const [dataSourceVersions, setDataSourceVersions] = useState<Record<string, number>>({});
  const refreshDataSource = useCallback<RefreshDataSource>(
    id => {
      setDataSourceVersions(prev => {
        return { ...prev, [id]: (prev[id] ?? 0) + 1 };
      });
    },
    []
  );

  const evaluationContext = useMemo<EvaluationContext>(
    () => {
      return {
        variables,
        user: hostUser,
        node: hostNode
      };
    },
    [variables, hostUser, hostNode]
  );

  // A stable ref to the live evaluation scope. Field validators read `.current`
  // at change/submit time, so `ctx` can stay stable (and cells keep their memo)
  // across `$vars` changes instead of re-rendering the whole field tree.
  const evaluationContextRef = useRef(evaluationContext);
  evaluationContextRef.current = evaluationContext;

  // The effect lane's renderer-owned sinks, bundled once so a new native effect
  // adds a field to `EffectSinks`, not another prop threaded through every scope.
  const sinks = useMemo<EffectSinks>(
    () => { return { setVariable, refreshDataSource }; },
    [setVariable, refreshDataSource]
  );

  // `formRef` keeps the live form available to the submit handler (which is
  // configured before `form` exists); `loadedFormRef` guards the one-shot
  // `load` effect so it fires once per form instance, not on re-renders.
  const formRef = useRef<RuntimeForm | null>(null);
  const loadedFormRef = useRef<RuntimeForm | null>(null);
  const form = useRuntimeForm({
    defaultValues,
    disabled,
    evaluators,
    evaluationContext,
    formRef,
    onSubmit,
    runtimeSchema,
    sinks
  });
  const { AppForm, Form } = form;

  useImperativeHandle(apiRef, () => {
    return {
      submit: () => form.handleSubmit(),
      reset: () => form.reset(),
      getValues: () => form.state.values
    };
  }, [form]);

  useEffect(() => {
    formRef.current = form;

    if (loadedFormRef.current === form) {
      return;
    }

    loadedFormRef.current = form;
    // `load` is fire-and-forget — nothing downstream waits on it; a rejected host
    // effect is contained so it does not surface as an unhandled rejection.
    dispatchFormEffects({
      actions: getTriggerEffectActions(runtimeSchema.linkage?.rules, "load"),
      evaluators,
      evaluationContext,
      form,
      sinks
    }).catch((error: unknown) => {
      console.error("[form-editor] load effect failed:", error);
    });
  }, [evaluators, evaluationContext, form, runtimeSchema, sinks]);

  const domIdPrefix = useId();

  // Memoized so the field tree's props are stable across the controller's
  // per-keystroke re-renders — a precondition for `React.memo(BlockCell)` to
  // actually bail. The form instance is stable; only schema/disabled drive it.
  const ctx = useMemo<RenderCtx>(
    () => {
      return {
        disabled,
        domIdPrefix,
        evaluators,
        evaluationContextRef,
        form,
        gutter: resolveStackGap(runtimeSchema.gap, DEFAULT_STACK_GAP),
        namePrefix: "",
        sinks
      };
    },
    [disabled, domIdPrefix, evaluators, evaluationContextRef, form, runtimeSchema.gap, sinks]
  );

  return (
    <AppForm>
      <EvaluationScopeContext value={evaluationContext}>
        <DataSourceProvider dataSources={runtimeSchema.dataSources} resolver={dataSourceResolver} versions={dataSourceVersions}>
          <RuntimeStateController evaluationContext={evaluationContext} evaluators={evaluators} form={form} schema={runtimeSchema} sinks={sinks}>
            <Form css={rootCss} disabled={disabled}>
              <BlockStack blocks={runtimeSchema.children} ctx={ctx} />
            </Form>
          </RuntimeStateController>
        </DataSourceProvider>
      </EvaluationScopeContext>
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

  return <BlockBody block={block} ctx={ctx} runtimeState={runtimeState} />;
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
  switch (block.type) {
    case "section": {
      return <SectionFlow ctx={withRuntimeDisabled(ctx, runtimeState)} section={block} />;
    }

    case "tabs": {
      return <TabsFlow ctx={withRuntimeDisabled(ctx, runtimeState)} tabs={block} />;
    }

    case "subform": {
      return <SubformFlow ctx={withRuntimeDisabled(ctx, runtimeState)} subform={block} />;
    }

    case "flex": {
      return <FlexFlow ctx={withRuntimeDisabled(ctx, runtimeState)} flex={block} />;
    }

    case "grid": {
      return <GridFlow ctx={withRuntimeDisabled(ctx, runtimeState)} grid={block} />;
    }

    default: {
      return <FieldSlot ctx={ctx} field={block} runtimeState={runtimeState} />;
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
 * replacement — a `set_field` writing the subform key, or a form `reset`:
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

// Per-row identity for the table variant's EditableTable. Lives ONLY in the
// table's view value — stripped before the committed form value — so it never
// reaches submitted data or exported JSON.
const SUBFORM_ROW_ID = "__rid";

/**
 * Subform dispatch. The `table` variant renders through the components
 * `EditableTable` on PC; everything else — the `stack` variant, or `table` on
 * mobile (`EditableTable` is desktop antd) — renders the stacked layout.
 */
function SubformFlow({ ctx, subform }: { ctx: RenderCtx; subform: SubformNode }): ReactElement {
  const device = useDevice();

  if (subform.variant === "table" && device === "pc") {
    return <SubformTable ctx={ctx} subform={subform} />;
  }

  return <SubformStack ctx={ctx} subform={subform} />;
}

/**
 * Table-variant subform. Binds the components `EditableTable` to the same
 * TanStack array field as the stack variant (controlled `value` / `onChange`),
 * mapping each template leaf field to a column editor. A per-row
 * {@link SUBFORM_ROW_ID} gives `EditableTable` stable row identity (it auto-fills
 * it for a freshly added row); it is injected into the view value and stripped
 * on write, so form state stays the clean record the schema / submit expect.
 *
 * Per-row linkage / evaluation scope is intentionally NOT wired here (those live
 * in the stack variant's per-row controllers) — the table targets straightforward
 * tabular entry.
 */
function SubformTable({ ctx, subform }: { ctx: RenderCtx; subform: TableSubform }): ReactElement {
  const chrome = useContainerChrome();
  const arrayName = `${ctx.namePrefix}${subform.key}`;
  const minRows = subform.minRows ?? 0;
  const idsRef = useRef<string[]>([]);
  const idSeedRef = useRef(0);
  // Row-wrapper cache keyed by the underlying TanStack row object: a keystroke
  // in one row replaces only that row's reference, so every untouched row keeps
  // its previous wrapped identity and rc-table's per-row memoization holds —
  // without this, the map below would mint fresh objects for ALL rows on every
  // render and force a cell diff across the whole table. Written during render:
  // safe because it is a pure idempotent memo (same row + id ⇒ equal wrapper).
  const wrappedRowsRef = useRef(new WeakMap<Record<string, unknown>, Record<string, unknown>>());

  const columns = useMemo(() => buildSubformColumns(subform.template), [subform.template]);
  const createRecord = useCallback(() => blankSubformRow(subform), [subform]);

  return (
    <chrome.Subform title={subform.label}>
      <ctx.form.AppField mode="array" name={arrayName}>
        {(fieldApi: RuntimeArrayFieldApi) => {
          const rows = (Array.isArray(fieldApi.state.value) ? fieldApi.state.value : []) as Array<Record<string, unknown>>;
          reconcileRowKeys(idsRef.current, rows.length, idSeedRef);
          const valueForTable = rows.map((row, index) => {
            const id = idsRef.current[index];
            const cached = wrappedRowsRef.current.get(row);

            if (cached && cached[SUBFORM_ROW_ID] === id) {
              return cached;
            }

            const wrapped = { ...row, [SUBFORM_ROW_ID]: id };

            wrappedRowsRef.current.set(row, wrapped);

            return wrapped;
          });

          const handleChange = (next: Array<Record<string, unknown>>): void => {
            // Record each row's id (EditableTable assigns one to a freshly added
            // row), then strip it so only the clean record reaches form state.
            idsRef.current = next.map((row, index) => {
              const id = row[SUBFORM_ROW_ID];
              // EditableTable always carries `__rid` (auto-assigned on add, kept
              // through edit), so the existing-id fallback is only a defensive
              // floor for an externally reseeded row.
              return typeof id === "string" ? id : idsRef.current[index] ?? `row-${index}`;
            });
            const clean = next.map(row => {
              const rest = { ...row };
              delete rest[SUBFORM_ROW_ID];
              return rest;
            });

            ctx.form.setFieldValue(arrayName, clean);
          };

          return (
            <EditableTable<Record<string, unknown>>
              canDelete={!ctx.disabled && rows.length > minRows}
              canEdit={!ctx.disabled}
              columns={columns}
              creatable={!ctx.disabled && (subform.maxRows === undefined || rows.length < subform.maxRows)}
              createRecord={createRecord}
              rowKey={SUBFORM_ROW_ID}
              size={subform.size}
              value={valueForTable}
              onChange={handleChange}
            />
          );
        }}
      </ctx.form.AppField>
    </chrome.Subform>
  );
}

/**
 * Stack-variant subform (the default). Binds to a TanStack Form array field; each
 * row renders the template with its field names prefixed `${key}[${i}].` and
 * evaluates linkage against that row's own value slice (see {@link SubformRow}).
 * `minRows` seeds and floors the row count; `maxRows` caps the add control.
 *
 * Rows carry a stable identity through a parallel key list (a ref + a
 * monotonic counter): removing row 0 must NOT hand row 1's values to row 0's
 * component instance, which would replay row-scoped condition effects off a
 * false rising edge and reset per-row tracker state. The add / remove handlers
 * are stable so `memo(SubformRow)` holds — typing in one row must not re-run
 * every other row's controller (an O(rows × template) evaluation per keystroke
 * otherwise).
 */
function SubformStack({ ctx, subform }: { ctx: RenderCtx; subform: SubformNode }): ReactElement {
  const chrome = useContainerChrome();
  const arrayName = `${ctx.namePrefix}${subform.key}`;
  const minRows = subform.minRows ?? 0;
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
    <chrome.Subform title={subform.label}>
      <ctx.form.AppField mode="array" name={arrayName}>
        {(fieldApi: RuntimeArrayFieldApi) => {
          arrayApiRef.current = fieldApi;

          const rows = Array.isArray(fieldApi.state.value) ? fieldApi.state.value : [];
          reconcileRowKeys(rowKeysRef.current, rows.length, rowKeySeedRef);
          const rowKeys = rowKeysRef.current;
          const canRemove = !ctx.disabled && rows.length > minRows;
          const canAdd = !ctx.disabled && (subform.maxRows === undefined || rows.length < subform.maxRows);

          return (
            <>
              {rows.map((_row, index) => (
                // eslint-disable-next-line @typescript-eslint/no-use-before-define -- forward reference in recursive component rendering
                <SubformRow
                  key={rowKeys[index]}
                  canRemove={canRemove}
                  ctx={ctx}
                  index={index}
                  subform={subform}
                  onRemove={handleRemove}
                />
              ))}

              {canAdd
                ? (
                    <chrome.AddButton
                      label={subform.addLabel ?? "新增一行"}
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
 * One subform row. A {@link SubformRowController} subscribes to this row's value
 * slice and publishes a nested runtime-state scope, so hide/disable/require
 * reflow and `assign` work inside the row exactly as they do at the root — and
 * only this row re-evaluates when its own record changes.
 *
 * Memoized with stable props (see {@link SubformFlow}) so a keystroke in one row
 * — which re-runs the array field's render prop — does not re-render the other
 * rows' controllers. Load-bearing at 100s of fields: without it every keystroke
 * in any row re-evaluates every row's template.
 */
function SubformRowBase({
  canRemove,
  ctx,
  index,
  onRemove,
  subform
}: {
  canRemove: boolean;
  ctx: RenderCtx;
  index: number;
  onRemove: (index: number) => void;
  subform: SubformNode;
}): ReactElement {
  const chrome = useContainerChrome();
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
  // memoized cells don't thrash on the controller's re-renders.
  const rowCtx = useMemo<RenderCtx>(
    () => {
      return { ...ctx, namePrefix: rowPrefix };
    },
    [ctx, rowPrefix]
  );

  return (
    <chrome.SubformRow removeControl={canRemove ? <chrome.RemoveButton onClick={() => onRemove(index)} /> : undefined}>
      <SubformRowScope ctx={ctx} prefix={rowPrefix} templateSchema={templateSchema}>
        <BlockStack blocks={subform.template} ctx={rowCtx} gap={subform.variant === "stack" ? subform.gap : undefined} />
      </SubformRowScope>
    </chrome.SubformRow>
  );
}

const SubformRow = memo(SubformRowBase);

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
      evaluationContext={evaluationContext}
      evaluators={ctx.evaluators}
      form={ctx.form}
      prefix={prefix}
      sinks={ctx.sinks}
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
  // The nearest value scope's effect dispatcher (root form or subform row), so a
  // field event fires its effects against the right record.
  const runEffects = useEffectDispatch();
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

  let content: ReactElement;

  if (isKeyedField(field)) {
    // Registered on the change lane only: TanStack Form's submit event runs the
    // change validator too (defaultValidationLogic), so submit-time coverage is
    // free — while a second registration under `onSubmit` would store the same
    // message in both errorMap lanes and render it twice after a failed submit.
    // `field` is narrowed to keyed in this branch, so the callback stays
    // type-safe without re-checking.
    const runValidation = ({ fieldApi, value }: { fieldApi: RuntimeFieldApi; value: unknown }): string | undefined => validateRuntimeField({
      disabled: ctx.disabled,
      evaluators: ctx.evaluators,
      evaluationContext: ctx.evaluationContextRef.current,
      field,
      namePrefix: ctx.namePrefix,
      value,
      values: fieldApi.form.state.values
    });

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
            required={isRuntimeRequired(field, runtimeState)}
            value={fieldApi.state.value}
            onChange={value => {
              fieldApi.handleChange(value);

              // The `change` edge fires off the framework onChange, not a DOM
              // event, so it is dispatched here rather than via the boundary.
              if (eventKinds.has("change")) {
                runEffects(getTriggerEffectActions(field.linkage?.rules, "change"));
              }
            }}
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
        <FieldEventBoundary eventKinds={eventKinds} rules={field.linkage?.rules} runEffects={runEffects}>
          {content}
        </FieldEventBoundary>
      )
    : content;
}

const eventBoundaryCss = css({ display: "contents" });

/**
 * Whether a field needs a DOM boundary to catch `focus` / `blur` / `click`
 * edges. The `change` edge rides the framework onChange and never needs one, so
 * a field with only `change` (or no) event rules renders with no wrapper.
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
  rules,
  runEffects
}: {
  children: ReactNode;
  eventKinds: Set<LinkageTriggerKind>;
  rules: FieldLinkageRule[] | undefined;
  runEffects: RunEffects;
}): ReactElement {
  return (
    <div
      css={eventBoundaryCss}
      onBlur={eventKinds.has("blur") ? () => runEffects(getTriggerEffectActions(rules, "blur")) : undefined}
      onClick={eventKinds.has("click") ? () => runEffects(getTriggerEffectActions(rules, "click")) : undefined}
      onFocus={eventKinds.has("focus") ? () => runEffects(getTriggerEffectActions(rules, "focus")) : undefined}
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
