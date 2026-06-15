import type { SemanticColor } from "@vef-framework-react/components";

import { ColorPicker } from "@vef-framework-react/components";
import { useDidUpdate } from "@vef-framework-react/hooks";
import { useState, useTransition } from "react";

import { useThemeStore } from "../../../../stores";

interface ThemeColorPickerProps {
  color: SemanticColor;
}

export function ThemeColorPicker({ color }: ThemeColorPickerProps): React.JSX.Element {
  const currentValue = useThemeStore(state => state.colors[color]);
  const [localValue, setLocalValue] = useState(currentValue);
  const [, startTransition] = useTransition();

  useDidUpdate(() => {
    setLocalValue(currentValue);
  }, [currentValue]);

  return (
    <ColorPicker
      arrow={false}
      format="hex"
      value={localValue}
      onChange={value => {
        setLocalValue(value.toHexString());
      }}
      onChangeComplete={value => {
        startTransition(() => {
          useThemeStore.setState(state => {
            state.colors[color] = value.toHexString();
          });
        });
      }}
    />
  );
}
