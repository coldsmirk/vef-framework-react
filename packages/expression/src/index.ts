export {
  compileBranch,
  compileCondition,
  compileGroup,
  selectBranch,
  selectBranchWith,
  toZenLiteral
} from "./condition/compile";

export {
  CONDITION_OPERATORS,
  type BranchSelection,
  type ConditionBranchInput,
  type ConditionGroupInput,
  type ConditionInput,
  type ConditionOperator,
  type ExpressionConditionInput,
  type FieldConditionInput
} from "./condition/types";

export { ExpressionError, ExpressionNotReadyError } from "./engine/errors";

export {
  evaluate,
  evaluateSync,
  evaluateUnary,
  evaluateUnarySync,
  getCompletions,
  validate,
  validateUnary
} from "./engine/evaluate";

export {
  analyzeTypes,
  analyzeTypesSync,
  getCompletionItems,
  getCompletionItemsSync,
  getDiagnostics,
  getDiagnosticsSync,
  satisfiesType,
  satisfiesTypeSync,
  type ExpressionAnalysis,
  type ExpressionCompletion,
  type ExpressionDiagnostic,
  type ExpressionMode,
  type ExpressionType,
  type ExpressionTypeSpan
} from "./engine/intellisense";

export {
  configureEngine,
  getEngineError,
  getEngineSync,
  isEngineReady,
  loadEngine,
  type ExpressionContext,
  type ExpressionEngine,
  type LoadEngineOptions
} from "./engine/loader";

export {
  getExpressionLocale,
  setExpressionLocale,
  type ExpressionLocale
} from "./engine/messages";
