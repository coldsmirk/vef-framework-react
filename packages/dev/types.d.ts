/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
/// <reference types="unplugin-icons/types/react" />

// Vite `define` injects these as build-time string-replacement globals. The
// surrounding double-underscores follow the build-tool convention for
// framework-injected names (akin to `__webpack_require__`); the lint exemption
// reflects that, rather than introducing a casing exception elsewhere.
/* eslint-disable @typescript-eslint/naming-convention -- Vite-injected globals use the double-underscore build-tool convention */

/**
 * The version of the vef framework
 */
declare const __VEF_FRAMEWORK_VERSION__: string;
/**
 * The version of the app
 */
declare const __VEF_APP_VERSION__: string;
/**
 * The configuration of the app
 */
declare const __VEF_APP_CONFIG__: Readonly<Record<string, string>>;

/* eslint-enable @typescript-eslint/naming-convention -- end of the Vite-global declarations */
