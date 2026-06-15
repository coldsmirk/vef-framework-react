import type { NodeSpecification } from "./types";

import { BasicNodeConfig } from "../components/config/basic-node-config";
import { NODE_KIND_LABELS } from "../constants";
import { StartIcon } from "../icons";
import { NODE_KIND_COLORS } from "../styles/node-colors";

export const startSpecification: NodeSpecification = {
  type: "start",
  label: NODE_KIND_LABELS.start,
  color: NODE_KIND_COLORS.start,
  icon: StartIcon,
  badgeVariant: "solid",
  configPanel: BasicNodeConfig
};
