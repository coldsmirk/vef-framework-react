import type { AnyRouter, RegisteredRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { AppProps, UseRouterContext } from "../components";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App, RouterContextHookProvider } from "../components";

export interface AppOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, unknown> = Record<string, unknown>
> {
  strictMode?: boolean;
  useRouterContext?: UseRouterContext<TRouter, TDehydrated>;
}

export interface AppInstance {
  render: (props: AppProps) => void;
  unmount: () => void;
}

export function createApp<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, unknown> = Record<string, unknown>
>({ strictMode = false, useRouterContext }: AppOptions<TRouter, TDehydrated> = {}): AppInstance {
  const root = createRoot(document.querySelector("#root")!, { identifierPrefix: "vef-" });

  function wrapApp(app: ReactNode): ReactNode {
    let wrapped = app;

    if (useRouterContext) {
      wrapped = (
        <RouterContextHookProvider value={useRouterContext}>
          {wrapped}
        </RouterContextHookProvider>
      );
    }

    if (strictMode) {
      wrapped = <StrictMode>{wrapped}</StrictMode>;
    }

    return wrapped;
  }

  return {
    render(props: AppProps) {
      root.render(wrapApp(<App {...props} />));
    },
    unmount() {
      root.unmount();
    }
  };
}
