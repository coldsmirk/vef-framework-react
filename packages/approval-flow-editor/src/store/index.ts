export { useApprovalActions } from "./approval-actions";
export type { ApprovalActions } from "./approval-actions";
export { anyNodeConfig, dataConfig, nodeConfig } from "./config-access";
export { buildEditorOptions, REJECTION_MESSAGES } from "./editor-options";
export { engineNodeRegistry } from "./engine-specs";
export { countIssuesByNode, EditorUiProvider, useEditorUiStore, useEditorUiStoreApi } from "./ui-store";
export type { EditorUiState } from "./ui-store";
// The graph engine is @coldsmirk/nodeloom-core: its provider-scoped store carries the nodes,
// edges, selection, history, and every mutation gate. Editor-local UI state (readonly mirror,
// hover, validation results) rides in the companion UI store, and the approval-domain mutators
// live in useApprovalActions.
export { useEditorStore, useEditorStoreApi } from "@coldsmirk/nodeloom-core";
export type { EditorState } from "@coldsmirk/nodeloom-core";
