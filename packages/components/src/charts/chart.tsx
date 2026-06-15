import type { CSSProperties } from "react";

import type { PropsWithRef } from "../_base";
import type { UseChartOptions } from "./hooks";

import { useMergedRef } from "@vef-framework-react/hooks";
import { isDeepEqual, isShallowEqual } from "@vef-framework-react/shared";
import { memo } from "react";

import { useChart } from "./hooks";

export interface ChartProps extends UseChartOptions {
  className?: string;
  style?: CSSProperties;
  deepMemo?: boolean;
}

function ChartComponent({
  className,
  style,
  ref,
  deepMemo: _deepMemo,
  ...options
}: PropsWithRef<HTMLDivElement, ChartProps>) {
  const containerRef = useChart(options);
  const mergedRef = useMergedRef(containerRef, ref);

  return (
    <div
      ref={mergedRef}
      className={className}
      style={style}
    />
  );
}

function arePropsEqual(prevProps: ChartProps, nextProps: ChartProps): boolean {
  const useDeepComparison = prevProps.deepMemo || nextProps.deepMemo;
  const compareFn = useDeepComparison ? isDeepEqual : isShallowEqual;

  if (!compareFn(prevProps.option, nextProps.option)) {
    return false;
  }

  return prevProps.className === nextProps.className
    && prevProps.style === nextProps.style
    && prevProps.theme === nextProps.theme
    && prevProps.loading === nextProps.loading
    && prevProps.group === nextProps.group
    && prevProps.width === nextProps.width
    && prevProps.height === nextProps.height
    && prevProps.renderer === nextProps.renderer;
}

export const Chart = memo(ChartComponent, arePropsEqual);
