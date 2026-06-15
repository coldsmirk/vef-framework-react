import type { MenuItem } from "@vef-framework-react/components";
import type { AuthTokens } from "@vef-framework-react/core";
import type { Except } from "@vef-framework-react/shared";

import type { AppCustomState, UserInfo, UserMenu } from "../types";

import { createPersistedStore } from "@vef-framework-react/core";

export interface AppState {
  isAuthenticated: boolean;
  authTokens?: Readonly<AuthTokens>;
  userInfo?: Readonly<Except<UserInfo, "permissionTokens">>;
  userMenuMap?: Readonly<Map<string, Readonly<UserMenu>>>;
  menuPathMap?: Readonly<Map<string, readonly string[]>>;
  menuItems?: ReadonlyArray<Readonly<MenuItem>>;
  permissionTokens?: Readonly<Set<string>>;
  custom: AppCustomState;
}

export const useAppStore = createPersistedStore<AppState>(
  () => {
    return {
      isAuthenticated: false,
      custom: {}
    };
  },
  {
    name: "app",
    storage: "local",
    selector: ({
      isAuthenticated,
      custom,
      authTokens
    }) => {
      return {
        isAuthenticated,
        custom,
        authTokens
      };
    }
  }
);
