import type { AnyRouter, RegisteredRouter } from "@tanstack/react-router";

import type { AppProps } from "../app";

/**
 * The props for the RouterProvider component.
 */
export interface RouterProviderProps<TRouter extends AnyRouter = RegisteredRouter, TDehydrated extends Record<string, any> = Record<string, any>> extends Pick<AppProps<TRouter, TDehydrated>, "router"> {
}
