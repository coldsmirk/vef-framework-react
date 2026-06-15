import type { ProSearchProps } from "../props";

import { SearchIcon } from "lucide-react";
import { memo } from "react";

import { useFormContext } from "../../form";
import { Icon } from "../../icon";

interface SearchActionsProps {
  loading?: boolean;
  searchButtonProps?: ProSearchProps<never>["searchButtonProps"];
  resetButtonProps?: ProSearchProps<never>["resetButtonProps"];
  onReset?: () => void;
}

const defaultSearchButtonProps: SearchActionsProps["searchButtonProps"] = {
  children: "搜索",
  color: "primary",
  icon: <Icon component={SearchIcon} />,
  variant: "outlined"
};

const defaultResetButtonProps: SearchActionsProps["resetButtonProps"] = {
  children: "重置"
};

export const SearchActions = memo(({
  loading,
  searchButtonProps = defaultSearchButtonProps,
  resetButtonProps = defaultResetButtonProps,
  onReset
}: SearchActionsProps) => {
  const { ResetButton, SubmitButton } = useFormContext();

  return (
    <>
      <SubmitButton {...searchButtonProps} loading={loading} />
      {resetButtonProps && <ResetButton {...resetButtonProps} onReset={onReset} />}
    </>
  );
});

SearchActions.displayName = "SearchActions";
