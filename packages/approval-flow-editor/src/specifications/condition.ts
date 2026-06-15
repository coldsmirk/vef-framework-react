import type { NodeSpecification } from "./types";

import { ConditionConfig } from "../components/config/condition-config";
import { NODE_KIND_LABELS } from "../constants";
import { ConditionIcon } from "../icons";
import { NODE_KIND_COLORS } from "../styles/node-colors";

export const conditionSpecification: NodeSpecification = {
  type: "condition",
  label: NODE_KIND_LABELS.condition,
  color: NODE_KIND_COLORS.condition,
  icon: ConditionIcon,
  configPanel: ConditionConfig
};
