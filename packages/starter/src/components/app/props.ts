import type { AnyRouter, RegisteredRouter, RouterProps } from "@tanstack/react-router";
import type { ApiClient, AppContext } from "@vef-framework-react/core";

import type { AppVersionNotificationOptions } from "../../helpers/app-version.js";

export interface AppProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, unknown> = Record<string, unknown>
> extends Pick<RouterProps<TRouter, TDehydrated>, "router"> {
  apiClient: ApiClient;
  appContext: AppContext;
  appVersionNotification?: AppVersionNotificationOptions;
}
