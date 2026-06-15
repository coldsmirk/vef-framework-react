import type { NodeSpecification } from "./types";

import { ApprovalNodeConfig } from "../components/config/approval-node-config";
import { NODE_KIND_LABELS } from "../constants";
import { ApprovalIcon } from "../icons";
import { NODE_KIND_COLORS } from "../styles/node-colors";

export const approvalSpecification: NodeSpecification = {
  type: "approval",
  label: NODE_KIND_LABELS.approval,
  color: NODE_KIND_COLORS.approval,
  icon: ApprovalIcon,
  configPanel: ApprovalNodeConfig
};
