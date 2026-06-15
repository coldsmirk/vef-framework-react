import type { NodeSpecification } from "./types";

import { HandleNodeConfig } from "../components/config/handle-node-config";
import { NODE_KIND_LABELS } from "../constants";
import { HandleIcon } from "../icons";
import { NODE_KIND_COLORS } from "../styles/node-colors";

export const handleSpecification: NodeSpecification = {
  type: "handle",
  label: NODE_KIND_LABELS.handle,
  color: NODE_KIND_COLORS.handle,
  icon: HandleIcon,
  configPanel: HandleNodeConfig
};
