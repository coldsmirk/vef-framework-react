import type { Awaitable } from "@vef-framework-react/shared";
import type { FC, ReactNode } from "react";

import type { ProSearchProps } from "./props";

import { memo, useCallback, useState } from "react";

import { useForm } from "../form";
import { AdvancedSearch, AdvancedSearchToggler, SearchActions } from "./components";
import * as styles from "./styles";

export const ProSearch = memo(<TValues = unknown>({
  className,
  defaultValues,
  extra,
  basicSearch,
  advancedSearch,
  disabled,
  loading,
  searchButtonProps,
  resetButtonProps,
  onSearch,
  onReset,
  defaultAdvancedSearchVisible = false,
  advancedSearchVisible: controlledVisible,
  onAdvancedSearchVisibleChange
}: ProSearchProps<TValues>) => {
  const [uncontrolledVisible, setUncontrolledVisible] = useState(defaultAdvancedSearchVisible);

  const isControlled = controlledVisible !== undefined;
  const isAdvancedSearchVisible = isControlled ? controlledVisible : uncontrolledVisible;

  const handleVisibleChange = useCallback((visible: boolean) => {
    if (!isControlled) {
      setUncontrolledVisible(visible);
    }

    onAdvancedSearchVisibleChange?.(visible);
  }, [isControlled, onAdvancedSearchVisibleChange]);

  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => {
      onSearch?.(value);
    }
  });

  const handleReset = useCallback(() => {
    // Defer store update to the next macro task using setTimeout
    // This allows the native form reset event to complete propagation first
    setTimeout(() => {
      onReset?.(defaultValues);
    }, 0);
  }, [onReset, defaultValues]);

  const handleToggle = useCallback(() => {
    handleVisibleChange(!isAdvancedSearchVisible);
  }, [handleVisibleChange, isAdvancedSearchVisible]);

  const { AppForm, Form } = form;

  return (
    <AppForm>
      <Form className={className} disabled={disabled || loading}>
        <div css={styles.content}>
          <div css={styles.contentLeft}>{extra}</div>

          <div css={styles.contentRight}>
            {advancedSearch && (
              <AdvancedSearchToggler
                isVisible={isAdvancedSearchVisible}
                onToggle={handleToggle}
              />
            )}

            {basicSearch}

            {(basicSearch || advancedSearch) && (
              <SearchActions
                loading={loading}
                resetButtonProps={resetButtonProps}
                searchButtonProps={searchButtonProps}
                onReset={handleReset}
              />
            )}
          </div>
        </div>

        {advancedSearch && (
          <AdvancedSearch isVisible={isAdvancedSearchVisible}>
            {advancedSearch}
          </AdvancedSearch>
        )}
      </Form>
    </AppForm>
  );
}) as (<TValues = unknown>(props: ProSearchProps<TValues>) => Awaitable<ReactNode>) & Pick<FC, "displayName">;
ProSearch.displayName = "ProSearch";

export type { ProSearchProps } from "./props";
