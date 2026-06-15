import type { UserConfig } from "vite";

import { DEFAULT_APP_NAME, ENV_APP_PREFIX, VEF_FRAMEWORK_VERSION } from "./constants";

type DefineConfig = NonNullable<UserConfig["define"]>;

export function defineConstants(appName: string | undefined, appVersion: string, isDev: boolean): DefineConfig {
  const appConfigValue = isDev
    ? `(function () {
        const env = import.meta.env;
        const config = Object.keys(env)
          .filter(key => key.startsWith(${JSON.stringify(ENV_APP_PREFIX)}))
          .reduce((acc, key) => {
            acc[key] = env[key];
            return acc;
          }, {});
        return Object.freeze(config);
      })()`
    : `window.__PRODUCTION__VEF_${appName ?? DEFAULT_APP_NAME}__CONF__`;

  // Keys MUST mirror the global names declared in `packages/dev/types.d.ts`;
  // Vite injects them via string substitution at build time, so the casing
  // is dictated by the consumer-side identifiers rather than by our style.
  /* eslint-disable @typescript-eslint/naming-convention */
  return {
    __VEF_FRAMEWORK_VERSION__: JSON.stringify(VEF_FRAMEWORK_VERSION),
    __VEF_APP_VERSION__: JSON.stringify(appVersion),
    __VEF_APP_CONFIG__: appConfigValue
  };
  /* eslint-enable @typescript-eslint/naming-convention */
}
