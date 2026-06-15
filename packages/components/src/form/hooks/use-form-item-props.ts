import type { FormItemProps } from "../types";

import { useMemo } from "react";

import { useFormLayout } from "../contexts";
import { useLabelWidth } from "./use-label-width";

export function useFormItemProps(props: FormItemProps) {
  const {
    layout,
    label,
    labelAlign,
    labelWidth,
    extra,
    noWrapper,
    required
  } = props;
  const formLayout = useFormLayout();

  const layoutToUse = layout ?? formLayout.layout;
  const labelWidthToUse = useLabelWidth(layoutToUse, labelWidth ?? formLayout.labelWidth);

  const labelCol = useMemo(() => {
    if (layoutToUse === "vertical" || !labelWidthToUse) {
      return;
    }

    return { flex: `0 0 ${labelWidthToUse}px` };
  }, [labelWidthToUse, layoutToUse]);

  return {
    layout: layoutToUse,
    label,
    labelAlign: labelAlign ?? formLayout.labelAlign,
    labelCol,
    extra,
    noStyle: noWrapper,
    required
  };
}
