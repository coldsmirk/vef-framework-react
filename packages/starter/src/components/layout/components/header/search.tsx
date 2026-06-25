import type { JSX } from "react";

import { IconButton } from "@vef-framework-react/components";
import { useHotkeys } from "@vef-framework-react/hooks";
import { SearchIcon } from "lucide-react";

import { useLayoutStore } from "../../store";

interface SearchProps {
  className?: string;
}

export function Search({ className }: SearchProps): JSX.Element {
  const setIsSearchVisible = useLayoutStore(state => state.setIsSearchVisible);

  function handleClick(): void {
    setIsSearchVisible(true);
  }

  useHotkeys("ctrl+shift+s", handleClick, { enableOnFormTags: true });

  return (
    <IconButton
      className={className}
      icon={<SearchIcon />}
      size="large"
      tip="搜索"
      tipDelay={1}
      onClick={handleClick}
    />
  );
}
