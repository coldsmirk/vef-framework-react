import type { Tab } from "../../../stores";

import { useNavigate } from "@tanstack/react-router";
import { scheduleMicrotask } from "@vef-framework-react/shared";
import { useCallback } from "react";

import { INDEX_ROUTE_PATH } from "../../../constants";

interface UseTabNavigateOptions {
  async?: boolean;
}

/**
 * Use the navigate function for the tab
 *
 * @returns The navigate function for the tab
 */
export function useTabNavigate({
  async = false
}: UseTabNavigateOptions = {}) {
  const navigate = useNavigate();

  return useCallback((tab?: Tab) => {
    const doNavigate = () => {
      if (tab) {
        navigate({
          to: tab.fullPath,
          params: tab.params,
          search: tab.search,
          viewTransition: false
        });
      } else {
        navigate({
          to: INDEX_ROUTE_PATH,
          viewTransition: false
        });
      }
    };

    if (async) {
      return scheduleMicrotask(doNavigate);
    }

    return doNavigate();
  }, [async, navigate]);
}
