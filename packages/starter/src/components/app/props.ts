import type { AnyRouter, RegisteredRouter, RouterProps } from "@tanstack/react-router";
import type { ComponentDefaults } from "@vef-framework-react/components";
import type { ApiClient, AppContext } from "@vef-framework-react/core";

import type { AppVersionNotificationOptions } from "../../helpers/app-version.js";
import type { DefaultTheme } from "../theme-config-provider";

export interface AppProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, unknown> = Record<string, unknown>
> extends Pick<RouterProps<TRouter, TDehydrated>, "router"> {
  apiClient: ApiClient;
  appContext: AppContext;
  appVersionNotification?: AppVersionNotificationOptions;
  /**
   * The theme the application starts from. The user's own picks in the theme
   * panel take precedence, and only those picks are persisted.
   */
  defaultTheme?: DefaultTheme;
  /**
   * Application-wide default props for framework components, limited to what
   * the framework whitelists per component.
   */
  components?: ComponentDefaults;
}
