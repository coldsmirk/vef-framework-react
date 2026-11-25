import type { RemoteDataSourceRequest, ResolvedDataSourceRequest } from "./data-source";
import type { DynamicValue } from "./dynamic-value";

/**
 * Linkage data model.
 *
 * A node declares how it reacts to the form via a list of **rules**. Every rule
 * is a single {@link LinkageTrigger} paired with an ordered list of
 * {@link FieldLinkageAction}s — one uniform shape that subsumes both classic
 * "linkage" (a value condition drives a state change) and "events" (a field /
 * form moment drives an ordered action sequence).
 *
 * The model is intentionally recursive and orthogonal:
 *
 * - **Condition** is a discriminated union of three kinds — `leaf`, `group`,
 * `expression` — that compose freely. A leaf evaluates a single operator
 * against one source path; a group joins children with `all` / `any`
 * logic; an expression is plain JavaScript run through the default
 * `new Function` evaluator or a host-supplied evaluator override.
 * - **Trigger** wraps a condition (a *level* signal, with rule-level
 * {@link ConditionRetrigger}) or names an *edge* — a field event
 * (`change` / `commit` / `focus` / `blur` / `click`) or a form lifecycle moment
 * (`load` / `beforeSubmit` / `afterSubmit`), optionally guarded by `when`.
 * - **Action** is one of two families: **state** actions (`show` / `hide` /
 * ... / `assign` / `script`) that derive a field's runtime state, and
 * **effect** actions (`api_call` / `select_record` / `set_fields` / ...) that
 * run sequentially in a rule's action sequence, passing results forward through
 * `$steps.<output>`.
 *
 * Expression and script evaluation remain pluggable via
 * {@link LinkageEvaluators}; external I/O (`request`, `navigate`, `notify`) is
 * injected through {@link FormServices}.
 */

/**
 * Comparison operators available on a leaf condition. `empty` / `notEmpty`
 * do not take a `value`; the others compare the source field's value to the
 * supplied `value` using loose-string equality (see `engine/linkage/operators`).
 */
export type LinkageOperator
  = | "eq"
    | "ne"
    | "gt"
    | "lt"
    | "gte"
    | "lte"
    | "contains"
    | "empty"
    | "notEmpty";

/**
 * Atomic condition that compares one source field's value with an operator.
 *
 * `id` is an optional client-stable identity: the visual editor mints one per
 * condition so list re-renders key off identity (not array index), keeping a
 * controlled editor pinned to its logical row across edits and middle removals.
 * The runtime and validator ignore it.
 */
export interface LinkageConditionLeaf {
  kind: "leaf";
  id?: string;
  sourceKey: string;
  operator: LinkageOperator;
  value?: unknown;
}

/**
 * Combines child conditions with a logical connector.
 *
 * - `all` short-circuits on the first false child.
 * - `any` short-circuits on the first true child.
 *
 * Empty `children` evaluates to `true` for `all` and `false` for `any`,
 * matching standard quantifier semantics. The editor UI keeps groups
 * non-empty.
 */
export interface LinkageConditionGroup {
  kind: "group";
  /**
   * Optional client-stable identity for editor list keys (see {@link LinkageConditionLeaf}).
   */
  id?: string;
  logic: "all" | "any";
  children: LinkageCondition[];
}

/**
 * Catch-all for cases the visual editor cannot express. The host project
 * supplies an evaluator that runs `source` against the form values and
 * returns a boolean.
 */
export interface LinkageConditionExpression {
  kind: "expression";
  /**
   * Optional client-stable identity for editor list keys (see {@link LinkageConditionLeaf}).
   */
  id?: string;
  source: string;
}

export type LinkageCondition
  = | LinkageConditionLeaf
    | LinkageConditionGroup
    | LinkageConditionExpression;

/**
 * Field-scoped edge triggers dispatched from a field's own interactions.
 */
export type FieldEventKind = "change" | "commit" | "focus" | "blur" | "click";

/**
 * Form-scoped lifecycle edge triggers.
 */
export type FormEventKind = "load" | "beforeSubmit" | "afterSubmit";

/**
 * How a `condition`-triggered rule's effect sequence re-fires as values change.
 * Configured on the trigger (one rule is one trigger unit; use two rules when
 * different retrigger policies are needed).
 *
 * - `"edge"` (default) — run once on the condition's false→true rising edge.
 * - `"always"` — re-run whenever the condition keeps holding and a field the
 * condition depends on changes (or any value changes for opaque expression
 * conditions).
 */
export type ConditionRetrigger = "edge" | "always";

/**
 * What makes a rule fire.
 *
 * - `condition` is a **level** signal: it is continuously true or false as
 * values change. It is the only trigger that feeds the pure state lane
 * ({@link "../engine/linkage/evaluator"!evaluateLinkage}); its rising edge (or
 * tracked source changes when `retrigger: "always"`) runs the rule's effect
 * sequence.
 * - The remaining kinds are **edges** that pulse once when they happen — field
 * events ({@link FieldEventKind}) and form lifecycle moments
 * ({@link FormEventKind}). An optional `when` guard is evaluated at trigger
 * time against the rule's value scope and evaluation context; if false, the
 * sequence does not run.
 */
export type LinkageTrigger
  = | { kind: "condition"; condition: LinkageCondition; retrigger?: ConditionRetrigger }
    | { kind: FieldEventKind | FormEventKind; when?: LinkageCondition };

/**
 * Discriminator extracted from {@link LinkageTrigger}.
 */
export type LinkageTriggerKind = LinkageTrigger["kind"];

/**
 * Default-state overrides applied before any rule fires. Useful for
 * "hidden by default, shown when condition matches" progressive forms.
 */
export interface FieldLinkageDefaults {
  hidden?: boolean;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Value used by an action that reads or writes dynamic data (`assign`,
 * `set_fields`, `set_variable`, `select_record`, `alert`, `navigate`).
 */
export type LinkageActionValue = DynamicValue;

/**
 * Severity passed to an `alert` effect, mirroring antd's alert/message levels.
 */
export type LinkageAlertLevel = "info" | "success" | "warning" | "error";

/**
 * Failure policy for a single step in an effect sequence.
 *
 * - `"stop"` (default) — abort the rest of the sequence when the step fails.
 * - `"continue"` — record `undefined` as the step's output (if named) and
 * continue to the next step.
 */
export type ActionErrorPolicy = "stop" | "continue";

/**
 * One target-field write inside a `set_fields` action.
 */
export interface FieldAssignment {
  targetKey: string;
  value: DynamicValue;
}

/**
 * One column displayed in the `select_record` picker when multiple records are
 * returned. `path` walks own properties of each candidate record.
 */
export interface SelectRecordColumn {
  path: string;
  label: string;
}

/**
 * What `select_record` does when zero records match or the user cancels the
 * picker: `"stop"` (default) terminates the sequence; `"continue"` stores
 * `undefined` under `$steps.<output>` and moves on (letting subsequent
 * `set_fields` clear target fields).
 */
export type SelectRecordWhenNone = "continue" | "stop";

/**
 * **State actions** derive a field's runtime state and are *level / continuous*:
 * while a condition holds the state is applied, and when it stops holding the
 * state reverts. They are meaningful only under a `condition` trigger, and the
 * pure state lane folds them into `RuntimeFieldState`.
 *
 * - `show` / `hide` / `enable` / `disable` apply to leaves and containers.
 * - `require` / `optional` / `assign` are keyed-leaf only (they touch a value).
 * - `script` is the escape hatch — host returns a partial state patch.
 */
export type StateAction
  = | { type: "show" | "hide" | "enable" | "disable" | "require" | "optional" }
    | { type: "assign"; value: LinkageActionValue }
    | { type: "script"; source: string };

/**
 * **Effect actions** run sequentially within a rule when its trigger fires.
 * Synchronous sequences finish in the same tick; async steps (`api_call`,
 * multi-record `select_record`, `submit`) await completion before advancing.
 * Named outputs (`output`) publish into `$steps.<output>` for later steps in
 * the same rule.
 */
export type EffectAction = (
  | { type: "set_fields"; assignments: FieldAssignment[] }
  | { type: "set_variable"; variable: string; value: DynamicValue }
  | { type: "api_call"; request: RemoteDataSourceRequest; output?: string }
  | {
    type: "select_record";
    source: DynamicValue;
    output: string;
    title?: string;
    columns?: SelectRecordColumn[];
    emptyMessage?: string;
    whenNone?: SelectRecordWhenNone;
  }
  | { type: "refresh_data_source"; dataSourceId: string }
  | { type: "alert"; level?: LinkageAlertLevel; message: DynamicValue }
  | { type: "navigate"; to: DynamicValue }
  | { type: "submit" }
  | { type: "reset" }
) & { onError?: ActionErrorPolicy };

/**
 * The unified action vocabulary shared by conditions and events. A rule carries
 * an ordered list of these; the runtime routes each by family — state actions
 * into the derived-state fold, effect actions into the side-effect lane.
 *
 * The `id` is an optional client-stable identity (minted by the editor) so the
 * actions list keys off identity rather than array index; the runtime ignores
 * it. Intersecting keeps the `type` discriminant — and thus narrowing — intact.
 */
export type FieldLinkageAction = (StateAction | EffectAction) & { id?: string };

/**
 * Discriminators, narrowed per family. {@link LinkageActionType} is the full
 * union; the engine's `isStateAction` / `isEffectAction` guards split them.
 */
export type StateActionType = StateAction["type"];
export type EffectActionType = EffectAction["type"];
export type LinkageActionType = FieldLinkageAction["type"];

/**
 * Partial state patch returned by a `script` action's body. Any omitted
 * key leaves the corresponding runtime-state slot untouched.
 *
 * `value` is the script equivalent of `assign` — setting it marks the
 * field assigned and applies the supplied value at the form-runtime level.
 */
export interface LinkageScriptResult {
  hidden?: boolean;
  disabled?: boolean;
  required?: boolean;
  value?: unknown;
}

/**
 * One linkage rule: a single {@link LinkageTrigger} paired with an ordered list
 * of {@link FieldLinkageAction}s. When the trigger fires, the actions run in
 * declaration order — state actions fold into the field's runtime state, effect
 * actions fire as side effects.
 */
export interface FieldLinkageRule {
  id: string;
  trigger: LinkageTrigger;
  actions: FieldLinkageAction[];
}

export interface FieldLinkage {
  defaults?: FieldLinkageDefaults;
  rules?: FieldLinkageRule[];
}

/**
 * Host capabilities injected into `FormRenderer` and `FormEditor` (and through
 * `ApprovalPlugins.services`), unifying transport, navigation, and notice
 * handling:
 *
 * - `request` serves both remote option sources (the framework maps returned
 * arrays or paginated `.items` using `RemoteOptionMapping`) and `api_call`
 * actions, with cooperative cancellation via `options.signal`.
 * - `navigate` performs route navigation for `navigate` actions.
 * - `notify` displays `alert` actions and `select_record.emptyMessage`; when
 * omitted, the runtime falls back to the framework message API.
 */
export interface FormServices {
  request?: (request: ResolvedDataSourceRequest, options: { signal: AbortSignal }) => Promise<unknown>;
  navigate?: (to: string) => void;
  notify?: (level: LinkageAlertLevel, text: string) => void;
}

/**
 * Server-resolved per-field interactivity clamp. Lockstep contract: mirrors the
 * Go backend's `approval.Permission` and approval-flow-editor's
 * `FieldPermission` literal-for-literal.
 *
 * The clamp is the OUTER bound on a keyed node's runtime state — linkage may
 * only narrow (hide / disable) within it, never widen past it:
 *
 * - `"hidden"` — never mounted, value never submitted.
 * - `"visible"` — mounted read-only (via the disabled channel), value never
 * submitted, exempt from validation, never required.
 * - `"editable"` — no clamp; linkage governs alone.
 * - `"required"` — editable and always required, overruling a linkage
 * `optional` outcome.
 */
export type FieldPermission = "visible" | "editable" | "hidden" | "required";

/**
 * Extra scope surfaced to expressions and scripts alongside the form values.
 * The default evaluator exposes these as `$vars` / `$user` / `$node` /
 * `$applicant` / `$globals` (plus `$form` for the values and `$now` for the
 * current time); all are optional, so an expression that only reads `field.x` /
 * `$form.x` keeps working when no context is supplied.
 */
export interface EvaluationContext {
  /**
   * Form-global variables (`$vars`), seeded from `FormSchema.variables`.
   */
  variables?: Record<string, unknown>;
  /**
   * Host-supplied info about whoever is viewing the form right now (`$user`) —
   * e.g. role-driven linkage in a single-user form.
   */
  user?: Record<string, unknown>;
  /**
   * Host-supplied workflow-node context (`$node`).
   */
  node?: Record<string, unknown>;
  /**
   * Host-supplied subject the form is filled on behalf of (`$applicant`) — in
   * a workflow, the initiator. Unlike `$user` it is the same for everyone who
   * opens one record, so a rule about the initiator evaluates identically for
   * the initiator and for each approver who later views the form.
   */
  applicant?: Record<string, unknown>;
  /**
   * Host-supplied global variables (`$globals`): read-only attributes the host
   * resolves rather than the schema declares — tenant settings, the initiator's
   * roles, business limits. Contrast `$vars`, the form's own writable
   * variables.
   */
  globals?: Record<string, unknown>;
  /**
   * Outputs produced by earlier steps of the currently running effect sequence
   * (`$steps`). Populated only while an action sequence executes; absent in
   * conditions, guards, state actions, and remote option-source params.
   */
  steps?: Record<string, unknown>;
}

/**
 * A host-declared context property — a "system variable" — that the designer
 * lists in its variables panel and that the visual condition builder offers as
 * a leaf-condition source alongside the form's own fields. `key` is the full
 * scope path — rooted at `$form` / `$vars` / `$user` / `$node` / `$applicant` /
 * `$globals`, e.g. `"$applicant.departmentId"` — stored verbatim as the leaf's
 * `sourceKey` and resolved at runtime against the live
 * {@link EvaluationContext}. Declaring a source only affects the designer;
 * evaluation reads the context either way, so an undeclared path written by
 * hand still resolves.
 */
export interface LinkageContextSource {
  /**
   * Scope path rooted at `$form` / `$vars` / `$user` / `$node` / `$applicant`
   * / `$globals`, e.g. `"$applicant.departmentId"`.
   */
  key: string;
  /**
   * Display name shown in the designer, e.g. `"发起人部门"`.
   */
  label: string;
}

/**
 * Pluggable pure evaluators for the dynamic parts of the model. Expression and
 * script slots default to plain-JavaScript `new Function` compilation; hosts
 * override any slot to swap in their own expression engine or script sandbox.
 * Side-effect capabilities live in {@link FormServices}, not here.
 *
 * The optional `context` argument carries the {@link EvaluationContext}
 * (`$vars` / `$user` / `$node` / `$applicant` / `$globals` / `$steps`); a host
 * evaluator may ignore it.
 */
export interface LinkageEvaluators {
  /**
   * Evaluates an expression-condition's `source` against the current
   * form values and returns a boolean. Should return `false` (not throw)
   * when the source is malformed.
   */
  evaluateExpression?: (source: string, values: Record<string, unknown>, context?: EvaluationContext) => boolean;
  /**
   * Evaluates a script-action's `source` against the current form values
   * and returns a state patch. Returning `void` is treated as no-op.
   */
  evaluateScriptAction?: (source: string, values: Record<string, unknown>, context?: EvaluationContext) => LinkageScriptResult | void;
  /**
   * Evaluates an assignment / value expression's `source` and returns the
   * computed value. Used by every action value with `{ kind: "expression" }`.
   */
  evaluateAssignExpression?: (source: string, values: Record<string, unknown>, context?: EvaluationContext) => unknown;
}
