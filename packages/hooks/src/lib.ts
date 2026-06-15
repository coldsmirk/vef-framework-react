import type { UseColorSchemeValue, UseMediaQueryOptions } from "@mantine/hooks";

import {
  useColorScheme as useColorSchemeInternal,
  useElementSize as useElementSizeInternal,
  useMediaQuery as useMediaQueryInternal,
  useReducedMotion as useReducedMotionInternal
} from "@mantine/hooks";

const DEFAULT_MEDIA_QUERY_OPTIONS: UseMediaQueryOptions = { getInitialValueInEffect: false };

export function useMediaQuery(
  query: string,
  initialValue?: boolean,
  options: UseMediaQueryOptions = DEFAULT_MEDIA_QUERY_OPTIONS
): boolean {
  return useMediaQueryInternal(query, initialValue, {
    getInitialValueInEffect: options.getInitialValueInEffect
  });
}

export function useColorScheme(
  initialValue?: UseColorSchemeValue,
  options: UseMediaQueryOptions = DEFAULT_MEDIA_QUERY_OPTIONS
): UseColorSchemeValue {
  return useColorSchemeInternal(initialValue, {
    getInitialValueInEffect: options.getInitialValueInEffect
  });
}

export function useReducedMotion(
  initialValue?: boolean,
  options: UseMediaQueryOptions = DEFAULT_MEDIA_QUERY_OPTIONS
): boolean {
  return useReducedMotionInternal(initialValue, {
    getInitialValueInEffect: options.getInitialValueInEffect
  });
}

const DEFAULT_ELEMENT_SIZE_OPTIONS: ResizeObserverOptions = { box: "border-box" };

export function useElementSize<T extends HTMLElement = any>(
  options: ResizeObserverOptions = DEFAULT_ELEMENT_SIZE_OPTIONS
): { ref: React.RefCallback<T | null>; width: number; height: number } {
  return useElementSizeInternal<T>(options);
}

export {
  assignRef,
  getHotkeyHandler,
  mergeRefs,
  useDebouncedCallback,
  useDebouncedState,
  useDebouncedValue,
  useDidUpdate,
  useDocumentTitle,
  useEventListener,
  useFocusTrap,
  useFullscreenDocument,
  useIntersection,
  useInterval,
  useIsFirstRender,
  useIsomorphicEffect,
  useMergedRef,
  useMounted,
  useMutationObserverTarget,
  usePrevious,
  useResizeObserver,
  useTimeout,
  useWindowEvent
} from "@mantine/hooks";

export {
  HotkeysProvider,
  useHotkeys,
  useHotkeysContext,
  useRecordHotkeys,
  type HotkeyCallback,
  type Options as HotkeysOptions
} from "react-hotkeys-hook";
