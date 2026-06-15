// Main component
export { ApprovalFlowEditor, type ApprovalFlowEditorProps } from "./components/approval-flow-editor";

// Constants
export { DEFAULT_NODE_DATA, isNodeKind, NODE_KIND_LABELS, NODE_KINDS, NODE_RULES, type NodeRule } from "./constants";

// Icons
export { ApprovalIcon, CcIcon, ConditionIcon, EndIcon, HandleIcon, StartIcon } from "./icons";

// Plugins
export type { EditorPlugins, PickerProps } from "./plugins";

export {
  validateFlowDefinition,
  type FlowValidationCode,
  type FlowValidationError
} from "./shared/flow-validation";

// Utilities
export { fromFlowDefinition, toFlowDefinition } from "./shared/serialization";
// Specifications
export {
  getAddableSpecifications,
  getAllSpecifications,
  getSpecification,
  type NodeSpecification
} from "./specifications";

// Store hooks for plugins/extensions. EditorStoreProvider stays internal:
// ApprovalFlowEditor mounts the provider itself, and a second one mounted by a
// host would create a split-brain store the canvas never reads.
export { useEditorStore, useEditorStoreApi, type EditorState } from "./store";

// Node accent colors (UI tokens — kept out of constants so non-UI layers stay pure)
export { NODE_KIND_COLORS } from "./styles/node-colors";

// Principal kinds — runtime helpers a host needs to build a complete picker map
// or settings UI without re-hardcoding the kind list.
export { isPrincipalKind, PRINCIPAL_KINDS } from "./types";

// Types
export type {
  AddAssigneeType,
  NodeData as AnyNodeData,
  ApprovalMethod,
  ApprovalNode,
  ApprovalNodeData,
  AssigneeDefinition,
  AssigneeKind,
  CcDefinition,
  CcFieldPermission,
  CcKind,
  CcNode,
  CcNodeData,
  CcTiming,
  ConditionBranchDefinition,
  ConditionDefinition,
  ConditionGroup,
  ConditionKind,
  ConditionNodeData,
  ConsecutiveApproverAction,
  EdgeDefinition,
  EmptyAssigneeAction,
  EndNodeData,
  ExecutionType,
  FieldKind,
  FieldOptionDefinition,
  FieldPermission,
  FlowDefinition,
  FlowEdge,
  FlowNode,
  FormFieldDefinition,
  HandleNode,
  HandleNodeData,
  NodeDataMap,
  NodeDefinition,
  NodeKind,
  PassRule,
  PrincipalKind,
  RollbackDataStrategy,
  RollbackType,
  SameApplicantAction,
  StartNode,
  StartNodeData,
  TaskNodeData,
  TimeoutAction
} from "./types";
