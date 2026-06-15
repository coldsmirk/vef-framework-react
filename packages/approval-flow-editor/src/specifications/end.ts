import type { NodeSpecification } from "./types";

import { BasicNodeConfig } from "../components/config/basic-node-config";
import { NODE_KIND_LABELS } from "../constants";
import { EndIcon } from "../icons";
import { NODE_KIND_COLORS } from "../styles/node-colors";

export const endSpecification: NodeSpecification = {
  type: "end",
  label: NODE_KIND_LABELS.end,
  color: NODE_KIND_COLORS.end,
  icon: EndIcon,
  badgeVariant: "solid",
  configPanel: BasicNodeConfig
};
