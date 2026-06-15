import type { CSSProperties, ReactNode } from "react";

import { useInsertionEffect } from "react";

interface AppProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export const ROOT_ELEMENT_ID = "root";

const WHITESPACE_REGEX = /\s+/;

export default function App({
  className,
  style,
  children
}: AppProps): ReactNode {
  useInsertionEffect(() => {
    if (!className && !style) {
      return;
    }

    const root = document.querySelector<HTMLElement>(`#${ROOT_ELEMENT_ID}`);

    if (className) {
      const classNames = className.split(WHITESPACE_REGEX).filter(Boolean);
      const cssVarClasses = classNames.filter(name => name.startsWith("css-var-"));
      const otherClasses = classNames.filter(name => !name.startsWith("css-var-"));

      if (cssVarClasses.length > 0) {
        document.documentElement.classList.add(...cssVarClasses);
      }

      if (otherClasses.length > 0 && root) {
        root.classList.add(...otherClasses);
      }
    }

    if (style && root) {
      Object.assign(root.style, style);
    }
  }, [className, style]);

  return <>{children}</>;
}
