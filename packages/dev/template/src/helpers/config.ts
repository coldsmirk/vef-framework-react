import type { AppConfig } from "~types";

import { camelCase } from "@vef-framework-react/shared";

const config = Object.fromEntries(
  Object.entries(__VEF_APP_CONFIG__).map(
    ([key, value]) => [camelCase(key.slice("VEF_APP_".length)), value]
  )
) as unknown as AppConfig;

export function getAppConfig<const K extends keyof AppConfig>(key: K): AppConfig[K] {
  return config[key];
}
