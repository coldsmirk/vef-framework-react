import type { ReactNode } from "react";

import { useShallow } from "@vef-framework-react/core";
import { memo } from "react";

import { ProSearch } from "../../pro-search";
import { useCrudStore } from "../store";
import * as styles from "../styles";
import { ToolbarActions } from "./toolbar-actions";

interface ToolbarProps {
  basicSearch?: ReactNode;
  advancedSearch?: ReactNode;
  toolbarActions?: ReactNode;
}

export const Toolbar = memo(({
  basicSearch,
  advancedSearch,
  toolbarActions
}: ToolbarProps) => {
  const {
    defaultSearchValues,
    setSearchValues,
    isQueryFetching
  } = useCrudStore(
    useShallow(state => {
      return {
        defaultSearchValues: state.defaultSearchValues,
        setSearchValues: state.setSearchValues,
        isQueryFetching: state.isQueryFetching
      };
    })
  );

  return (
    <ProSearch
      advancedSearch={advancedSearch}
      basicSearch={basicSearch}
      css={styles.toolbar}
      defaultValues={defaultSearchValues}
      extra={<ToolbarActions toolbarActions={toolbarActions} />}
      loading={isQueryFetching}
      onReset={setSearchValues}
      onSearch={setSearchValues}
    />
  );
});
Toolbar.displayName = "Toolbar";
