import type { ReactElement } from "react";

import type { SemanticScene } from "../types";

import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { PresetColors } from "antd/es/theme/internal";

export const presetColors = PresetColors;

export const semanticScenes = ["success", "info", "warning", "error"] as const;

export const semanticSceneLabels: Record<SemanticScene, string> = {
  success: "成功",
  info: "提示",
  warning: "警告",
  error: "错误"
};

export const semanticSceneIcons: Record<SemanticScene, ReactElement> = {
  success: <CheckCircleOutlined />,
  info: <InfoCircleOutlined />,
  warning: <ExclamationCircleOutlined />,
  error: <CloseCircleOutlined />
};

export const semanticColors = ["primary", ...semanticScenes] as const;

export const colors = [...presetColors, ...semanticColors] as const;

export const sizes = ["small", "medium", "large"] as const;

export const fullSizes = ["extra-small", ...sizes, "extra-large"] as const;
