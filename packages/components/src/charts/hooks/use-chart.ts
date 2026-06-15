import type { AnyObject, Except } from "@vef-framework-react/shared";
import type { ECharts, EChartsInitOpts, EChartsOption, SetOptionOpts } from "echarts";
import type { RefObject } from "react";

import { useDidUpdate } from "@vef-framework-react/hooks";
import { isNullish, isString } from "@vef-framework-react/shared";
import * as echarts from "echarts";
import { useEffect, useEffectEvent, useRef } from "react";

import { useThemeTokens } from "../../_base";
import { useIsDarkMode } from "../../config-provider";
import { registerWaldenDarkTheme, registerWaldenTheme, registerWonderlandDarkTheme, registerWonderlandTheme } from "../themes";

export interface UseChartOptions extends Except<EChartsInitOpts, "width" | "height">, SetOptionOpts {
  option: EChartsOption;
  theme?: "walden" | "wonderland" | AnyObject;
  loading?: boolean;
  width?: number | "auto";
  height?: number | "auto";
  group?: string;
  onReady?: (chart: ECharts) => void;
  onBeforeDispose?: (chart: ECharts) => void;
}

let themesRegistered = false;

function registerThemes(): void {
  if (themesRegistered) {
    return;
  }

  registerWonderlandTheme();
  registerWonderlandDarkTheme();
  registerWaldenTheme();
  registerWaldenDarkTheme();
  themesRegistered = true;
}

function getEffectiveTheme(theme: "walden" | "wonderland" | AnyObject, isDarkMode: boolean): string | AnyObject {
  if (!isString(theme)) {
    return theme;
  }

  return isDarkMode ? `${theme}-dark` : theme;
}

const RESIZE_ANIMATION = {
  duration: 300,
  easing: "elasticOut"
} as const;

export function useChart({
  option,
  theme = "walden",
  loading = false,
  group,
  onReady,
  onBeforeDispose,
  notMerge,
  replaceMerge,
  lazyUpdate = true,
  silent,
  transition,
  renderer = "svg",
  devicePixelRatio,
  width,
  height,
  ssr,
  useCoarsePointer,
  useDirtyRect,
  pointerSize,
  locale
}: UseChartOptions): RefObject<HTMLDivElement | null> {
  registerThemes();

  const {
    colorPrimary,
    colorBgMask,
    fontSize,
    colorTextDescription
  } = useThemeTokens();
  const isDarkMode = useIsDarkMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts>(null);
  const resizeObserverRef = useRef<ResizeObserver>(null);

  const effectiveTheme = getEffectiveTheme(theme, isDarkMode);

  const onReadyFn = useEffectEvent((chart: ECharts) => {
    onReady?.(chart);
  });

  const onBeforeDisposeFn = useEffectEvent((chart: ECharts) => {
    onBeforeDispose?.(chart);
  });

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const chart = echarts.init(container, effectiveTheme, {
      renderer,
      devicePixelRatio,
      width,
      height,
      ssr,
      useCoarsePointer,
      useDirtyRect,
      pointerSize,
      locale
    });

    chartRef.current = chart;

    const needsResizeObserver = isNullish(width) || isNullish(height) || width === "auto" || height === "auto";

    if (needsResizeObserver) {
      resizeObserverRef.current = new ResizeObserver(() => {
        chart.resize({ animation: RESIZE_ANIMATION });
      });
      resizeObserverRef.current.observe(container);
    }

    onReadyFn(chart);

    return () => {
      onBeforeDisposeFn(chart);
      resizeObserverRef.current?.disconnect();
      chart.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  }, [renderer, devicePixelRatio, ssr, useCoarsePointer, useDirtyRect, pointerSize, locale]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    chart.group = group ?? "";
  }, [group]);

  useDidUpdate(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    chart.setTheme(effectiveTheme as never);
  }, [effectiveTheme]);

  useDidUpdate(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    chart.resize({
      width,
      height,
      animation: RESIZE_ANIMATION
    });
  }, [width, height]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    chart.setOption(option, {
      notMerge,
      replaceMerge,
      lazyUpdate,
      silent,
      transition
    });
  }, [option, notMerge, lazyUpdate, replaceMerge, silent, transition]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    if (loading) {
      chart.showLoading("default", {
        text: "加载中...",
        textColor: colorTextDescription,
        fontSize,
        color: colorPrimary,
        maskColor: colorBgMask,
        zlevel: 0,
        showSpinner: true,
        spinnerRadius: fontSize,
        lineWidth: 6
      });
    } else {
      chart.hideLoading();
    }
  }, [loading, colorBgMask, colorPrimary, colorTextDescription, fontSize]);

  return containerRef;
}

export type { ECharts as ChartInstance, EChartsOption as ChartOption } from "echarts";
