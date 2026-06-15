import type { RemoteDataSourceRequest } from "./data-source";

/**
 * Linkage data model.
 *
 * A node declares how it reacts to the form via a list of **rules**. Every rule
 * is a single {@link LinkageTrigger} paired with an ordered list of
 * {@link FieldLinkageAction}s — one uniform shape that subsumes both classic
 * "linkage" (a value condition drives a state change) and "events" (a field /
 * form moment drives a side effect). An event is simply a rule whose trigger is
 * an edge instead of a value condition.
 *
 * The model is intentionally recursive and orthogonal:
 *
 * - **Condition** is a discriminated union of three kinds — `leaf`, `group`,
 * `expression` — that compose freely. A leaf evaluates a single operator
 * against one source field; a group joins children with `all` / `any`
 * logic; an expression delegates to a host-supplied JS evaluator.
 * - **Trigger** wraps a condition (a *level* signal) or names an *edge* — a
 * field event (`change` / `focus` / `blur` / `click`) or a form lifecycle
 * moment (`load` / `beforeSubmit` / `afterSubmit`).
 * - **Action** is one of two families: **state** actions (`show` / `hide` /
 * ... / `assign` / `script`) that derive a field's runtime state, and
 * **effect** actions (`alert` / `set_field` / ...) that fire side effects.
 *
 * The framework only ships the JSON shape and the recursion. Expression /
 * script evaluation and side-effect dispatch are pluggable via
 * {@link LinkageEvaluators} so hosts choose their own JS engine, sandbox, or
 * effect runtime.
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
 * What makes a rule fire.
 *
 * - `condition` is a **level** signal: it is continuously true or false as
 * values change. It is the only trigger that feeds the pure state lane
 * ({@link "../engine/linkage/evaluator"!evaluateLinkage}); its false→true rising
 * edge also drives effect actions, each of which tunes its own re-firing via
 * {@link ConditionRetrigger}.
 * - The remaining kinds are **edges** that pulse once when they happen — field
 * events (`change` / `focus` / `blur` / `click`) and form lifecycle moments
 * (`load` / `beforeSubmit` / `afterSubmit`). They never derive durable state;
 * they drive the side-effect lane only.
 *
 * This single dimension is what unifies "linkage" and "events": an event is a
 * rule with an edge trigger and no value to compare against.
 */
export type LinkageTrigger
  = | { kind: "condition"; condition: LinkageCondition }
    | { kind: "change" }
    | { kind: "focus" }
    | { kind: "blur" }
    | { kind: "click" }
    | { kind: "load" }
    | { kind: "beforeSubmit" }
    | { kind: "afterSubmit" };

/**
 * How a single **effect** action re-fires under a `condition` trigger as values
 * change. Configured per effect action (not on the trigger) so one rule can mix
 * a re-firing `alert` with a once-only `api_call`. Ignored under an edge trigger
 * (`change` / `click` / ...), which already pulses on every event, and on state
 * actions, which are level-derived every render regardless.
 *
 * - `"edge"` (default) — fire once on the condition's false→true rising edge.
 * Entering the condition triggers the effect; it then stays quiet while the
 * condition keeps holding. This is the standard side-effect semantic and
 * prevents `api_call` / `navigate` / `submit` spam on every keystroke.
 * - `"always"` — fire every time the condition is true *and* a field the
 * condition depends on changes (e.g. "re-warn on each edit while the value is
 * out of range"). An unrelated field changing does not re-fire it. Expression
 * conditions have opaque dependencies, so they fall back to firing on any
 * value change while the condition holds.
 */
export type ConditionRetrigger = "edge" | "always";

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
 * Value used by an action that writes data (`assign`, `set_field`, `alert`,
 * `navigate`). A literal carries the value verbatim; an expression is computed
 * at runtime via the injected evaluator.
 */
export type LinkageActionValue
  = | { kind: "literal"; value: unknown }
    | { kind: "expression"; source: string };

/**
 * Severity passed to an `alert` effect, mirroring antd's alert/message levels.
 */
export type LinkageAlertLevel = "info" | "success" | "warning" | "error";

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
 * **Effect actions** are *edge-fired side effects*: they run once when a trigger
 * fires (a condition's false→true rising edge, a field event, or a form
 * lifecycle moment). They never derive durable state — state must stay
 * reconstructible from values — so writing another field is `set_field` (an
 * imperative one-shot write), distinct from the continuous self-`assign`.
 *
 * `set_field` / `set_variable` / `refresh_data_source` / `submit` / `reset` are
 * handled natively by the runtime (it owns the form api, the `$vars` store, and
 * the data-source refresh versions); `alert` / `api_call` / `navigate` are
 * delegated to the host's {@link LinkageEvaluators.dispatchEffect} (a no-op by
 * default), mirroring the `DataSourceResolver` injection seam.
 *
 * Every effect carries an optional {@link ConditionRetrigger} (`retrigger`)
 * controlling how it re-fires under a `condition` trigger; it defaults to
 * `"edge"` and is ignored under edge triggers. Intersecting it onto the union
 * (rather than repeating it per member) keeps the `type` discriminant — and thus
 * narrowing — intact.
 */
export type EffectAction = (
  | { type: "alert"; level?: LinkageAlertLevel; message: LinkageActionValue }
  | { type: "set_field"; targetKey: string; value: LinkageActionValue }
  | { type: "set_variable"; variable: string; value: LinkageActionValue }
  | { type: "refresh_data_source"; dataSourceId: string }
  | { type: "api_call"; request: RemoteDataSourceRequest }
  | { type: "navigate"; to: LinkageActionValue }
  | { type: "submit" }
  | { type: "reset" }
) & { retrigger?: ConditionRetrigger };

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
 * Context handed to the host's {@link LinkageEvaluators.dispatchEffect} so it
 * can render an alert, fire an API call, or navigate using the values present
 * when the effect fired.
 */
export interface EffectDispatchContext {
  /**
   * The form values in the firing rule's value scope at the moment the effect
   * ran (a subform row's effect sees that row's record, not the root form).
   */
  values: Record<string, unknown>;
  /**
   * Resolve a literal / expression action value against {@link values}.
   */
  resolveValue: (value: LinkageActionValue) => unknown;
}

/**
 * Extra scope surfaced to expressions and scripts alongside the form values.
 * The default evaluator exposes these as `$vars` / `$user` / `$node` (plus
 * `$form` for the values and `$now` for the current time); all are optional, so
 * an expression that only reads `field.x` / `$form.x` keeps working when no
 * context is supplied.
 */
export interface ExpressionContext {
  /**
   * Form-global variables (`$vars`), seeded from `FormSchema.variables`.
   */
  variables?: Record<string, unknown>;
  /**
   * Host-supplied current-user info (`$user`) — e.g. role-driven linkage.
   */
  user?: Record<string, unknown>;
  /**
   * Host-supplied workflow-node context (`$node`).
   */
  node?: Record<string, unknown>;
}

/**
 * Pluggable evaluators for the dynamic parts of the model. The expression /
 * script slots default to a `new Function`-based implementation provided by the
 * engine package; `dispatchEffect` defaults to a no-op. Hosts override any slot
 * to swap in their own JS engine, sandbox, or effect runtime.
 *
 * The optional `context` argument carries the {@link ExpressionContext}
 * (`$vars` / `$user` / `$node`); a host evaluator may ignore it.
 */
export interface LinkageEvaluators {
  /**
   * Evaluates an expression-condition's `source` against the current
   * form values and returns a boolean. Should return `false` (not throw)
   * when the source is malformed.
   */
  evaluateExpression?: (source: string, values: Record<string, unknown>, context?: ExpressionContext) => boolean;
  /**
   * Evaluates a script-action's `source` against the current form values
   * and returns a state patch. Returning `void` is treated as no-op.
   */
  evaluateScriptAction?: (source: string, values: Record<string, unknown>, context?: ExpressionContext) => LinkageScriptResult | void;
  /**
   * Evaluates an assignment / value expression's `source` and returns the
   * computed value. Used by every action value with `{ kind: "expression" }`.
   */
  evaluateAssignExpression?: (source: string, values: Record<string, unknown>, context?: ExpressionContext) => unknown;
  /**
   * Handles the host-delegated effect actions (`alert` / `api_call` /
   * `navigate`). The runtime handles `set_field` / `set_variable` /
   * `refresh_data_source` / `submit` / `reset` itself and never routes them
   * here. Defaults to a no-op so a form with effect actions
   * degrades gracefully when the host wires none — exactly as a `remote` data
   * source resolves to an empty list without a resolver.
   */
  dispatchEffect?: (action: EffectAction, context: EffectDispatchContext) => void | Promise<void>;
}
