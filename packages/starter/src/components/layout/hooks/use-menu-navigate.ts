import type { UserMenu } from "../../../types";

import { useNavigate } from "@tanstack/react-router";
import { isPlainObject } from "@vef-framework-react/shared";
import { useCallback } from "react";

/**
 * Use the navigate function for the menu
 *
 * @returns The navigate function for the menu
 */
export function useMenuNavigate() {
  const navigate = useNavigate();

  return useCallback(({ path, meta }: UserMenu) => {
    const { params, search } = meta ?? {};

    return navigate({
      to: path,
      params: isPlainObject(params) ? params : undefined,
      search: isPlainObject(search) ? search : undefined,
      viewTransition: false
    });
  }, [navigate]);
}
