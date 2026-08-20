import { isRedirect } from "@tanstack/react-router";

import { INDEX_ROUTE_PATH } from "../constants";
import { useAppStore } from "../stores";
import { createLoginRouteOptions } from "./login";

const CustomLoginPage = () => null;

function loginOptions() {
  return createLoginRouteOptions({ onLogin: () => Promise.resolve({}) });
}

/**
 * `beforeLoad` signals a redirect by throwing one, so the thrown value is the
 * assertion target rather than an error message.
 */
function guard(redirect: string): unknown {
  try {
    loginOptions().beforeLoad({ search: { redirect } });

    return undefined;
  } catch (error) {
    return error;
  }
}

beforeEach(() => {
  useAppStore.setState({ isAuthenticated: false });
});

describe("createLoginRouteOptions", () => {
  it("renders the page the application supplied", () => {
    expect(createLoginRouteOptions({ component: CustomLoginPage }).component).toBe(CustomLoginPage);
  });

  it("renders the framework's page when none is supplied", () => {
    expect(loginOptions().component).not.toBe(CustomLoginPage);
  });

  it("keeps the redirect the visitor arrived with", () => {
    expect(loginOptions().validateSearch.parse({ redirect: "/reports" })).toEqual({ redirect: "/reports" });
  });

  it("falls back to the index route when the redirect is unusable", () => {
    expect(loginOptions().validateSearch.parse({ redirect: 42 })).toEqual({ redirect: INDEX_ROUTE_PATH });
  });

  it("lets an unauthenticated visitor reach the login page", () => {
    expect(guard("/reports")).toBeUndefined();
  });

  it("sends an already-authenticated visitor to their redirect", () => {
    useAppStore.setState({ isAuthenticated: true });

    const redirected = guard("/reports");

    expect(isRedirect(redirected)).toBe(true);
    expect((redirected as { options: unknown }).options).toMatchObject({ to: "/reports", replace: true });
  });
});
