import type { GlobalToken } from "antd";

import { theme } from "antd";

export function useThemeTokens(): GlobalToken {
  const { token } = theme.useToken();
  return token;
}
