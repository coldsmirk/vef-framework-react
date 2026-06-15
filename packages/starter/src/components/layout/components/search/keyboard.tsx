import type { PropsWithChildren, ReactNode } from "react";

import { css } from "@emotion/react";
import { globalCssVars, isFragment, Keyboard as KeyboardInternal } from "@vef-framework-react/components";
import { Children } from "react";

interface KeyboardProps extends PropsWithChildren {
  icon: ReactNode;
}

const keyboardStyle = css({
  display: "flex",
  alignItems: "center",
  columnGap: globalCssVars.spacingXs
});

export function Keyboard({ icon, children }: KeyboardProps): React.JSX.Element {
  const iconNodes = Children.map(icon, node => {
    if (isFragment(node)) {
      return (
        <>
          {Children.map(node.props.children, child => (
            <KeyboardInternal>
              {child}
            </KeyboardInternal>
          ))}
        </>
      );
    }

    return (
      <KeyboardInternal>
        {node}
      </KeyboardInternal>
    );
  });

  return (
    <div css={keyboardStyle}>
      {iconNodes}
      <span>{children}</span>
    </div>
  );
}
