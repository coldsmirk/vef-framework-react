import { useGridContext } from "../context";

export function useGridCollapsed() {
  const { isCollapsed, setCollapsed } = useGridContext();

  return {
    isCollapsed,
    setCollapsed
  };
}
