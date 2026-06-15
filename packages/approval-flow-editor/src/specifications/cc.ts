import type { NodeSpecification } from "./types";

import { CcNodeConfig } from "../components/config/cc-node-config";
import { NODE_KIND_LABELS } from "../constants";
import { CcIcon } from "../icons";
import { NODE_KIND_COLORS } from "../styles/node-colors";

export const ccSpecification: NodeSpecification = {
  type: "cc",
  label: NODE_KIND_LABELS.cc,
  color: NODE_KIND_COLORS.cc,
  icon: CcIcon,
  configPanel: CcNodeConfig
};
