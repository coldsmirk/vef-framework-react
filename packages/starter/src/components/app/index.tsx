import type { AnyRouter, RegisteredRouter } from "@tanstack/react-router";

import type { AppProps } from "./props";

import { ApiClientProvider, AppContextProvider, MotionProvider } from "@vef-framework-react/core";
import { useEffect } from "react";

import { setupAppVersionNotification } from "../../helpers/app-version";
import { NProgress } from "../n-progress";
import { RouterProvider } from "../router-provider";
import { ThemeConfigProvider } from "../theme-config-provider";

const INIT_LOADER_ID = "__vef-initialization-loader";

function removeInitLoader(): void {
  const loader = document.querySelector(`#${INIT_LOADER_ID}`);

  if (loader) {
    requestAnimationFrame(() => {
      loader.remove();
    });
  }
}

export function App<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, unknown> = Record<string, unknown>
>({
  apiClient,
  appContext,
  appVersionNotification,
  router
}: AppProps<TRouter, TDehydrated>): React.ReactElement {
  useEffect(() => {
    if (document.readyState === "complete") {
      removeInitLoader();
      return;
    }

    window.addEventListener("load", removeInitLoader);

    return () => {
      window.removeEventListener("load", removeInitLoader);
    };
  }, []);

  useEffect(
    () => setupAppVersionNotification(appVersionNotification),
    [appVersionNotification]
  );

  return (
    <AppContextProvider value={appContext}>
      <ApiClientProvider value={apiClient}>
        <MotionProvider>
          <ThemeConfigProvider>
            <NProgress />
            <RouterProvider router={router} />
          </ThemeConfigProvider>
        </MotionProvider>
      </ApiClientProvider>
    </AppContextProvider>
  );
}

export { type AppProps } from "./props";
